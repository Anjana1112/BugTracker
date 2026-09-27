// Shared "is this requester a member of the project that owns this
// resource" predicates, used as a spread-in `where` fragment alongside an
// id lookup — e.g.
//   prisma.project.findFirst({ where: { projectId, ...projectMemberWhere(userId) } })
// Returning null from such a lookup means "404, don't reveal it exists."
export function projectMemberWhere(userId: number) {
    return { teamMembers: { some: { userId } } };
}

export function ticketMemberWhere(userId: number) {
    return { project: { teamMembers: { some: { userId } } } };
}

export function commentMemberWhere(userId: number) {
    return { ticket: { project: { teamMembers: { some: { userId } } } } };
}
