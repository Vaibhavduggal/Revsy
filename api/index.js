module.exports = async (req, res) => {
  const mod = await import('../server/src/app.js');
  const app = await mod.getApp();
  return app(req, res);
};
