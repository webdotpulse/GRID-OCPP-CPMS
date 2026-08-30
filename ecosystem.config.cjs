module.exports = {
  apps: [
    {
      name: "ocpp-backend",
      cwd: "./Backend",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ocpp-frontend",
      cwd: "./Frontend",
      script: "node_modules/.bin/next",
      args: "start -p 3002",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
