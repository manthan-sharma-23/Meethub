module.exports = {
    apps: [
        {
            name: "meethub-server",
            cwd: "./",  
            script: "npm",
            args: "run dev",
            watch: true,
            env: {
                NODE_ENV: "development",
            },
        },
    ],
};
