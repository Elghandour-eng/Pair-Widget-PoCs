module.exports = {
  apps: [{
    name: 'pair-widget-studio',
    cwd: __dirname,
    script: 'server/dist/index.js',
    node_args: '--env-file=.env',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production' },
    out_file: '/var/log/pair-widget-studio.out.log',
    error_file: '/var/log/pair-widget-studio.err.log',
    merge_logs: true,
    time: true,
  }],
}
