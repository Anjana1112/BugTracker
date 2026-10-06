import app from './app.js'

const port = process.env.PORT || 3000;

// Host only, never credentials — makes it obvious which database this
// process is talking to (an inline DATABASE_URL wins over .env).
function databaseHost(): string {
    try {
        return new URL(process.env.DATABASE_URL ?? "").host || "<unset>";
    } catch {
        return "<unparseable DATABASE_URL>";
    }
}

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback instead
// of throwing. Ignoring the argument used to print "Server running" while
// another, older process kept serving the port — exit loudly instead.
app.listen(port, (err?: Error) => {
    if (err) {
        const inUse = (err as NodeJS.ErrnoException).code === "EADDRINUSE";
        console.error(
            inUse
                ? `Port ${port} is already in use by another process — this server did NOT start. Stop the other process (lsof -nP -iTCP:${port} -sTCP:LISTEN) or set PORT.`
                : `Failed to start server on port ${port}: ${err.message}`
        );
        process.exit(1);
    }
    console.log(`Server running on ${port} (database: ${databaseHost()})`);
});
