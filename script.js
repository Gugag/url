async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value;
    if (!longUrl) {
        alert('Please enter a URL');
        return;
    }
    
    const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
    
    try {
        const response = await fetch(apiUrl);
        const shortUrl = await response.text();
        document.getElementById('result').innerHTML = `Shortened URL: <a href="${shortUrl}" target="_blank">${shortUrl}</a><br><br><br><button onclick="copyToClipboard('${shortUrl}')">Copy</button>`;
    } catch (error) {
        document.getElementById('result').innerText = 'Error shortening URL';
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Create a custom alert element
        const alertBox = document.createElement('div');
        alertBox.textContent = 'Shorten URL Copied Successful';
  
        // Style the alertBox for a centered toast message
        Object.assign(alertBox.style, {
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#4CAF50',
          color: '#fff',
          padding: '15px 25px',
          borderRadius: '5px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          zIndex: 1000,
          opacity: '1',
          transition: 'opacity 0.5s ease'
        });
  
        // Append the alert to the body
        document.body.appendChild(alertBox);
  
        // Fade out and remove the alert after 2 seconds
        setTimeout(() => {
          alertBox.style.opacity = '0';
          // Remove the element after the fade-out transition
          setTimeout(() => {
            alertBox.remove();
          }, 500);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  }
