export default function handler(req, res) {
  res.status(200).json({ status: "ok", message: "TTR-AI API is healthy", nodeVersion: process.version });
}
