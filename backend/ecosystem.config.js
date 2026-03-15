module.exports = {
  apps: [
    {
      name: "stafftrack-backend",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};

