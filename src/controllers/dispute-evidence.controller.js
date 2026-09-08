function createDisputeEvidenceController({ disputesService }) {
  return {
    async getEvidence(req, res) {
      const file = await disputesService.getEvidence({ user: req.user, admin: req.admin, filename: req.params.filename });
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      return new Promise((resolve, reject) => {
        res.sendFile(file.path, { cacheControl: false, lastModified: false, acceptRanges: false },
          (error) => error ? reject(error) : resolve());
      });
    }
  };
}

module.exports = { createDisputeEvidenceController };
