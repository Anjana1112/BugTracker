import type { Response } from "express";
import { ValidationError } from "./validation.js";

function mapPrismaError(err: any): { status: number; message: string } | null {
    if (err?.code === "P2025") {
        return { status: 400, message: "One or more referenced records were not found" };
    }
    if (err?.code === "P2002") {
        const target = err?.meta?.target;
        const field = Array.isArray(target) ? target.join(", ") : (target ?? "field");
        return { status: 409, message: `A record with this ${field} already exists` };
    }
    if (err?.code === "P2003") {
        return {
            status: 409,
            message: "Cannot complete this action because related records still reference it",
        };
    }
    return null;
}

export function handleControllerError(err: any, res: Response, fallbackMessage: string): void {
    if (err instanceof ValidationError) {
        res.status(err.status).json({ message: err.message });
        return;
    }

    const mapped = mapPrismaError(err);
    if (mapped) {
        res.status(mapped.status).json({ message: mapped.message });
        return;
    }

    res.status(500).json({ message: `${fallbackMessage}: ${err.message}` });
}
