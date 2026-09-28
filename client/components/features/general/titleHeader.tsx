import React from "react"

type Props = {
  name: string
  isSmallText?: boolean
}
const Header = ({ name, isSmallText = false }: Props) => {
  return (
    <div className="flex w-full items-center justify-between">
      <h1
        className={`${isSmallText ? "text-lg" : "text-2xl"} font-semibold text-foreground`}
      >
        {name}
      </h1>
    </div>
  )
}

export default Header
