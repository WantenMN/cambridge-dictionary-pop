chrome.runtime.onMessage.addListener(handleMessages);

let audioPlayer;

function getAudioPlayer() {
  if (!audioPlayer) {
    audioPlayer = document.createElement('audio');
    document.body.appendChild(audioPlayer);
  }
  return audioPlayer;
}

function handleMessages(message) {
  if (message.target !== 'offscreen') {
    return false;
  }

  if (message.type === 'play-audio') {
    const player = getAudioPlayer();
    player.src = message.data.src;
    player.play();
    return false;
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
      return false;
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

    definitionBlock.querySelectorAll('span.daud div[onclick]').forEach(div => {
      div.className = 'i-volume-up';
      const onclickAttr = div.getAttribute('onclick');
      if (onclickAttr) {
        const match = onclickAttr.match(/(audio\d+)\./);
        if (match && match[1]) {
          const audioId = match[1];
          const audioEl = doc.querySelector(`#${audioId}`);
          if (audioEl) {
            const sourceEl = audioEl.querySelector('source[type="audio/mpeg"]');
            if (sourceEl) {
              let src = sourceEl.getAttribute('src');
              if (src) {
                if (src.startsWith('/')) {
                  src = cambridgeHost + src;
                }
                div.setAttribute('data-audio-src', src);
              }
            }
          }
        }
      }
      div.removeAttribute('onclick');
    });

    definitionBlock.querySelectorAll('audio.hdn').forEach(el => el.remove());

    chrome.runtime.sendMessage({
      type: 'parse-definition-response',
      payload: definitionBlock.innerHTML
    });
    return false;
  }
  
  return false;
}
