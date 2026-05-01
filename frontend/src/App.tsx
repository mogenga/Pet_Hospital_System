import { TooltipProvider } from "@/components/ui/tooltip"

function App() {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold">宠物医院管理系统</h1>
      </div>
    </TooltipProvider>
  )
}

export default App
