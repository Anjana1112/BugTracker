import React from "react"
import ReactDOM from "react-dom"
import Header from "../features/general/titleHeader"
import { Button } from "./button"
import { X } from "lucide-react"
type Props = {
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
  name: string
}

const Modal = ({ children, isOpen, onClose, name }: Props) => {
  if (!isOpen) return null
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <Header name={name} />
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 rounded-full p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  )
}

export default Modal
