module.exports = {
    apps: [
        {
            name: "meethub-server",
            cwd: ".",  // Ensure the correct directory
            script: "npm",
            args: "run dev",
            watch: true,
            env: {
                NODE_ENV: "development",
            },
        },
    ],
};
