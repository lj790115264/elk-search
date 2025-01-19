function parseCurl(curlCommand) {
  const urlMatch = curlCommand.match(/curl ['"]([^'"]+)['"]/);
  if (!urlMatch) throw new Error('Invalid curl command: URL not found');
  
  const headers = {};
  const headerMatches = Array.from(curlCommand.matchAll(/-H ['"]([^'"]+)['"]/g));
  if (!headerMatches.length) {
    throw new Error('No valid headers found in curl command');
  }
  
  for (const match of headerMatches) {
    const header = match[1];
    const sepIndex = header.indexOf(': ');
    if (sepIndex === -1) {
      throw new Error(`Invalid header format: ${header}`);
    }
    const key = header.slice(0, sepIndex);
    const value = header.slice(sepIndex + 2);
    headers[key] = value;
  }

  let pattern = /--data-raw\s+(['"])(.*?)\1/;
  // 查找匹配
  let bodyMatch = pattern.exec(curlCommand);
  
  let body = null;
  if (bodyMatch) {
    try {
      body = JSON.parse(bodyMatch[2].trim());
    } catch (e) {
      throw new Error(`Invalid JSON in request body: ${e.message}`);
    }
  }
  if (body.batch) {
    console.log(body.batch[0])
    const esBody = body.batch[0].request.params.body;
    const esIndex = body.batch[0].request.params.index;
   
    return {
      url: urlMatch[1],
      headers,
      esBody,
      esIndex
    };
  }
}

async function makeRequest(curlCommand) {
  try {
    const { url, headers, esBody, esIndex } = parseCurl(curlCommand);
    
    const requestUrl = `http://jmsth-logskb.jms.com/api/console/proxy?path=/${esIndex}/_search?scroll=1m&method=GET`;
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: esBody ? JSON.stringify(esBody) : null
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(response);
    
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
    const key = header.slice(0, sepIndex);
    const value = header.slice(sepIndex + 2);
    headers[key] = value;
  }
  

  const bodyMatch = curlCommand.match(/--data-raw\s*['"](.*?)['"]/s);
  console.log(bodyMatch)
  let body = null;
  if (bodyMatch) {
    try {
      body = JSON.parse(bodyMatch[1]);
    } catch (e) {
      throw new Error(`Invalid JSON in request body: ${e.message}`);
    }
  }
  
  const esBody = body.batch.request.body
  const esIndex = body.batch.request.index
  
  return {
    url: urlMatch[1],
    headers,
    esBody,
    esIndex
  };
}

async function makeRequest(curlCommand) {
  try {
    const { url, headers, esBody, esIndex } = parseCurl(curlCommand);
    
    const requestUrl = `http://jmsth-logskb.jms.com/api/console/proxy?path=/${esIndex}/_search?scroll=1m&method=GET`;
    

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: esBody ? JSON.stringify(esBody) : null
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(response)
    
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const convertBtn = document.getElementById('convert-btn');
  const outputDiv = document.getElementById('output');
  const curlInput = document.getElementById('curl-input');

  convertBtn.addEventListener('click', async () => {
    const curlCommand = curlInput.value.trim();
    if (!curlCommand) {
      outputDiv.textContent = 'Please enter a curl command';
      return;
    }

    try {
      outputDiv.textContent = 'Processing...';
      const result = await makeRequest(curlCommand);
      outputDiv.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      outputDiv.textContent = `Error: ${error.message}`;
    }
  });
});
