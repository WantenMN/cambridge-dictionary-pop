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

    const audioSources = definitionBlock.querySelectorAll('source[type="audio/mpeg"]');
    audioSources.forEach(source => {
      const src = source.getAttribute('src');
      if (src && src.startsWith('/')) {
        source.setAttribute('src', cambridgeHost + src);
      }
    });

    definitionBlock.querySelectorAll('span.daud div[onclick]').forEach(div => {
      div.className = 'i-volume-up';
      const onclickAttr = div.getAttribute('onclick');
      if (onclickAttr) {
        const match = onclickAttr.match(/(audio\d+)\./);
        if (match && match[1]) {
          const audioId = match[1];
          div.setAttribute('onclick', `this.getRootNode().querySelector('#${audioId}').play()`);
        }
      }
    });

    chrome.runtime.sendMessage({
      type: 'parse-definition-response',
      payload: definitionBlock.innerHTML
    });
  }
}
