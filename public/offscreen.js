chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
  if (message.target !== 'offscreen') {
    return;
  }

  if (message.type === 'parse-definition') {
    const { html, filterSelectors, cambridgeHost } = message.data;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Remove unwanted elements
    filterSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(element => element.remove());
    });

    // Find the definition block
    const definitionBlock = doc.querySelector('.page');
    if (!definitionBlock) {
      chrome.runtime.sendMessage({
        type: 'parse-definition-response',
        error: 'Definition not found'
      });
      return;
    }

    // Process links within the definition block
    const links = definitionBlock.querySelectorAll('a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('/')) {
        link.setAttribute('href', cambridgeHost + href);
      }
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });

    chrome.runtime.sendMessage({
      type: 'parse-definition-response',
      payload: definitionBlock.innerHTML
    });
  }
}
