// Convert display name to URL-friendly format
function toUrlFriendlyName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Convert URL-friendly name back to display format
function fromUrlFriendlyName(urlName) {
  return urlName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = {
  toUrlFriendlyName,
  fromUrlFriendlyName,
};
