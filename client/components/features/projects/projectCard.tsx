import React from "react"
import { Project } from "@/lib/api"
type Props = {
  project: Project
}

const ProjectCard = ({ project }: Props) => {
  return (
    <div className="rounded border p-4 shadow">
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <p>
        {project.startDate} - {project.endDate}
      </p>
    </div>
  )
}

export default ProjectCard
