import React from "react"
import { Ticket } from "@/lib/api"
type Props = {
  ticket: Ticket
}

const ProjectCard = ({ ticket }: Props) => {
  return (
    <div className="rounded border p-4 shadow">
      <h3>{ticket.title}</h3>
      <p>{ticket.description}</p>
      <p>{ticket.startDate}</p>
      <p>{ticket.authorUserId}</p>
      <p>{ticket.dueDate}</p>
      <p>{ticket.status}</p>
      <p>{ticket.priority}</p>
      <p>{ticket.type}</p>
      <div>
        {ticket.ticketAssignments && ticket.ticketAssignments.length > 0 ? (
          <ul>
            {ticket.ticketAssignments.map((assignment, idx) => (
              <li key={idx}>{assignment.userId}</li>
            ))}
          </ul>
        ) : (
          <p>No assigned users</p>
        )}
      </div>
    </div>
  )
}

export default ProjectCard
