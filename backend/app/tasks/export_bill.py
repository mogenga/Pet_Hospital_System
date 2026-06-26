"""账单 PDF 导出任务 — Celery 异步任务 + BackgroundTasks 同步回退"""

import asyncio
import io
import logging
from datetime import datetime

import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.shared.minio import ensure_bucket, minio_client

from .celery_app import celery_app

logger = logging.getLogger(__name__)

# 注册中文字体 — 按优先级查找系统 TTF 字体
_FONT_CANDIDATES = [
    # Linux (常用中文字体包)
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    # macOS
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    # Windows
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simsun.ttc",
]

CN_FONT = "Helvetica"  # fallback

for _font_path in _FONT_CANDIDATES:
    if os.path.isfile(_font_path):
        try:
            _font_name = os.path.splitext(os.path.basename(_font_path))[0]
            pdfmetrics.registerFont(TTFont(_font_name, _font_path))
            CN_FONT = _font_name
            logger.info("PDF 中文字体已注册: %s (%s)", _font_name, _font_path)
            break
        except Exception as _e:
            logger.warning("PDF 字体注册失败 %s: %s", _font_path, _e)
    else:
        logger.debug("PDF 字体候选不存在: %s", _font_path)
else:
    logger.warning("未找到任何中文字体，PDF 中文将无法正常显示！")

# 同步引擎用于 Celery 任务（Celery worker 不共享 FastAPI 的 async engine）
SYNC_PG_URL = settings.PG_URL.replace("+asyncpg", "+psycopg2")


async def _generate_and_upload_pdf(bill_id: int):
    """异步查询账单数据 → 生成 PDF → 上传 MinIO，返回 file_key"""
    engine = create_async_engine(settings.PG_URL)
    try:
        async with engine.connect() as conn:
            # 查询账单
            bill_result = await conn.execute(
                text(
                    "SELECT b.bill_id, b.visit_id, b.status, "
                    "TO_CHAR(b.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, "
                    "v.total_amount "
                    "FROM v_bill_total v "
                    "JOIN bill b ON b.bill_id = v.bill_id "
                    "WHERE b.bill_id = :id"
                ),
                {"id": bill_id},
            )
            bill_row = bill_result.fetchone()
            if bill_row is None:
                raise ValueError(f"账单 {bill_id} 不存在")

            # 查询收费项
            items_result = await conn.execute(
                text(
                    "SELECT bill_item_id, item_type, source_type, source_id, "
                    "description, amount "
                    "FROM bill_item WHERE bill_id = :bid ORDER BY bill_item_id"
                ),
                {"bid": bill_id},
            )
            items = items_result.fetchall()
    finally:
        await engine.dispose()

    # 生成 PDF
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CNTitle", parent=styles["Title"], fontName=CN_FONT, fontSize=18
    )
    header_style = ParagraphStyle(
        "CNHeader", parent=styles["Normal"], fontName=CN_FONT, fontSize=10
    )

    elements = [
        Paragraph("宠物医院管理系统", title_style),
        Spacer(1, 5 * mm),
        Paragraph(f"账单编号：{bill_row.bill_id}　　就诊编号：{bill_row.visit_id}", header_style),
        Paragraph(
            f"创建时间：{bill_row.created_at}　　状态：{bill_row.status}",
            header_style,
        ),
        Spacer(1, 8 * mm),
    ]

    # 收费项表格
    table_data = [["序号", "类型", "来源", "描述", "金额(元)"]]
    for i, item in enumerate(items, 1):
        table_data.append([
            str(i),
            item.item_type,
            f"{item.source_type}#{item.source_id}",
            item.description or "-",
            f"{float(item.amount):.2f}",
        ])

    total = float(bill_row.total_amount or 0)
    table_data.append(["", "", "", "合计", f"{total:.2f}"])

    table = Table(table_data, colWidths=[40, 80, 100, 180, 80])
    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F97316")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), CN_FONT),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (3, -1), "LEFT"),
            ("ALIGN", (4, 0), (4, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -2), 0.5, colors.grey),
            ("LINEBELOW", (0, -2), (-1, -2), 1, colors.black),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#FFF7ED")),
        ])
    )
    elements.append(table)
    elements.append(Spacer(1, 10 * mm))
    elements.append(
        Paragraph(
            f"打印时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            header_style,
        )
    )

    doc.build(elements)

    # 上传 MinIO
    buf.seek(0)
    file_key = f"exports/bills/{bill_id}.pdf"
    try:
        ensure_bucket()
        minio_client.put_object(
            bucket_name=settings.MINIO_BUCKET,
            object_name=file_key,
            data=buf,
            length=buf.getbuffer().nbytes,
            content_type="application/pdf",
        )
        logger.info(f"账单 PDF 已导出: {file_key}")
    except Exception as e:
        logger.error(f"账单 PDF 上传 MinIO 失败 bill_id={bill_id}: {e}")
        raise  # 重新抛出，让 Celery/BackgroundTasks 感知失败

    return file_key


@celery_app.task(name="export_bill_pdf")
def export_bill_pdf(bill_id: int):
    """Celery 任务：生成账单 PDF 并上传 MinIO"""
    asyncio.run(_generate_and_upload_pdf(bill_id))


async def export_bill_background(bill_id: int):
    """BackgroundTasks 版本：同步调用（FastAPI 后台任务）"""
    await _generate_and_upload_pdf(bill_id)
