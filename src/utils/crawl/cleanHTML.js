import he from 'he';

export const cleanHTML = ($) => {
  // Remove unwanted elements
  const $aux = $;
  $aux(CONFIG.CRAWLER.DOM_ELEMENTS_REMOVE.join(',')).remove();
  $aux('*').contents().filter((_, el) => el.type === 'comment').remove();

  // Get the text content of the body element, ensuring spaces between child elements
  let bodyText = getTextWithSpaces($aux, $aux('body'));

  // Decode HTML entities
  bodyText = he.decode(bodyText, { level: 'all' });

  // Clean up the resulting text
  return bodyText
    .replace(/\n/g, ' ') // Replace newlines with a space
    .replace(/\\['"\\]/g, match => match.slice(1)) // Replace escaped characters with the unescaped character
    .replace(/[\u200B\u00A0\u2028\u2029\u202F\u00AD\u2060\uFEFF]/g, ' ') // Replace zero-width spaces with a space
    .replace(/\s{2,}/g, ' ') // Replace multiple spaces with a single space
    .trim();
};

// Custom function to get text content with spaces between elements
const getTextWithSpaces = ($, element) => {
  let text = '';
  element.contents().each((_, el) => {
    if (el.type === 'text') {
      text += $(el).text() + ' ';
    } else if (el.type === 'tag') {
      text += getTextWithSpaces($, $(el));
    }
  });
  return text;
};
