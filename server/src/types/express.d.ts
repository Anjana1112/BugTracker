import "express";

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number;
                username: string;
                email: string;
                role: string;
            };
        }
    }
}
