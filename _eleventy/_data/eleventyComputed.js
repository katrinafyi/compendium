module.exports = {
  title: (data) => (data.title || data.page.fileSlug),
};