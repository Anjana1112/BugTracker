import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { authHeader } from "./authHelper.js";
import { createUser, createProject, createTicket } from "./factories.js";

describe("GET /search", () => {
    it("requires auth", async () => {
        const res = await request(app).get("/search?q=widget");
        expect(res.status).toBe(401);
    });

    it("returns empty results for a query shorter than 2 characters", async () => {
        const user = await createUser();
        const res = await request(app)
            .get("/search?q=a")
            .set(authHeader(user));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ tickets: [], projects: [], users: [] });
    });

    it("finds matching tickets, projects, and users (happy path)", async () => {
        const user = await createUser();
        const project = await createProject({ name: "Widgetmaker Overhaul" }, [user.userId]);
        await createTicket({
            projectId: project.projectId,
            authorUserId: user.userId,
            title: "Widget renders incorrectly",
        });
        const widgetUser = await createUser({ username: "WidgetFan" });

        const res = await request(app)
            .get("/search?q=widget")
            .set(authHeader(user));

        expect(res.status).toBe(200);
        expect(res.body.projects.some((p: any) => p.projectId === project.projectId)).toBe(true);
        expect(
            res.body.tickets.some((t: any) => t.title === "Widget renders incorrectly")
        ).toBe(true);
        expect(res.body.users.some((u: any) => u.userId === widgetUser.userId)).toBe(true);
    });

    it("does not return tickets/projects outside the requester's memberships", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const privateProject = await createProject(
            { name: "Confidential Rocket Plans" },
            [owner.userId]
        );
        await createTicket({
            projectId: privateProject.projectId,
            authorUserId: owner.userId,
            title: "Confidential launch sequence bug",
        });

        const res = await request(app)
            .get("/search?q=confidential")
            .set(authHeader(outsider));

        expect(res.status).toBe(200);
        expect(
            res.body.projects.some((p: any) => p.projectId === privateProject.projectId)
        ).toBe(false);
        expect(
            res.body.tickets.some((t: any) => t.title === "Confidential launch sequence bug")
        ).toBe(false);
    });
});
