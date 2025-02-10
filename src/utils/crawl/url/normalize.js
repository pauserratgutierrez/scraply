export const normalizeURL = (url) => {
  const urlObj = new URL(url);
  urlObj.hash = ''; // Remove the fragment part
  urlObj.search = ''; // Remove the query part
  urlObj.protocol = 'https:'; // Force HTTPS
  urlObj.pathname = urlObj.pathname.endsWith('/')
    ? urlObj.pathname.slice(0, -1)
    : urlObj.pathname; // Remove trailing slashes
  urlObj.pathname = urlObj.pathname === ''
    ? '/'
    : urlObj.pathname; // Handle the root URL separately
  urlObj.hostname = urlObj.hostname.replace(/^www\./, ''); // Remove 'www.' prefix
  return urlObj.toString();
};
