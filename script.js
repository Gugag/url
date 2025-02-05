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
    navigator.clipboard.writeText(text).then(() => {
        alert('Shorten URL Copied Successful');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}