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
    const esBody = body.batch[0].request.params.body
    const esIndex = body.batch[0].request.params.index;
   
    return {
      url: urlMatch[1],
      headers,
      esBody,
      esIndex
    };
  }
}

async function makeRequestSrcoll(curlCommand) {
  try {
    const { url, headers, esBody, esIndex } = parseCurl(curlCommand);
    headers['kbn-xsrf'] = 'kibana'
    const pageSize = parseInt(document.getElementById('page-size').value) || 50;
    esBody['size'] = pageSize;
    const baseUrl = document.getElementById('parsed-url').value;
    const requestUrl = `${baseUrl}?path=/${esIndex}/_search?scroll=1m&method=GET`;

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: esBody ? JSON.stringify(esBody) : null
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

async function makeRequestDeepScroll(curlCommand, scrollId) {
  try {
    const { url, headers} = parseCurl(curlCommand);
    headers['kbn-xsrf'] = 'kibana'       
    const baseUrl = document.getElementById('parsed-url').value;
    const requestUrl = `${baseUrl}?path=%2F_search%2Fscroll&method=POST`;
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
          "scroll": "1m",
          "scroll_id": scrollId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}


document.getElementById('custom-processor').value = `"sign":"(.*?)",`

let isRunning = false;
let shouldStop = false;
let globalRes = []; // 用于存储结果的全局变量

document.addEventListener('DOMContentLoaded', () => {
  const convertBtn = document.getElementById('convert-btn');
  const outputDiv = document.getElementById('output');
  const curlInput = document.getElementById('curl-input');
  const parsedUrlInput = document.getElementById('parsed-url');

  // 监听curl输入框变化
  curlInput.addEventListener('input', () => {
    const curlCommand = curlInput.value.trim();
    const parsedUrlInputVal = parsedUrlInput.value.trim()
    
    if (parsedUrlInputVal != '') {
      console.log(parsedUrlInputVal)
      return;
    }
    
    try {
      const urlMatch = curlCommand.match(/curl ['"]([^'"]+)['"]/);
      if (urlMatch && !parsedUrlInput.value) {
        try {
          const url = new URL(urlMatch[1]);
          parsedUrlInput.value = `http://${url.hostname}/api/console/proxy`;
        } catch (error) {
          console.error('URL解析错误:', error);
        }
      }
    } catch (error) {
      console.error('URL解析错误:', error);
    }
  });

  convertBtn.addEventListener('click', async () => {
    if (isRunning) {
      shouldStop = true;
      convertBtn.textContent = 'Convert & Execute';
      convertBtn.disabled = false;
      isRunning = false;
      return;
    }

    const curlCommand = curlInput.value.trim();
    if (!curlCommand) {
      outputDiv.textContent = 'Please enter a curl command';
      return;
    }

    try {
      isRunning = true;
      shouldStop = false;
      convertBtn.textContent = 'STOP';
      convertBtn.disabled = false;

      const res = []
      outputDiv.textContent = 'Processing...';
      const result = await makeRequestSrcoll(curlCommand);
      
      resAdd(res, result)
      
      const _scrollId = result._scroll_id

      const maxIterations = parseInt(document.getElementById('max-iterations').value) || 10;
      console.log(maxIterations)
      for (let i = 0; i < maxIterations; i++) {
        if (shouldStop) {
          break;
        }

        try {
          await new Promise(resolve => setTimeout(resolve, 20)); // 休眠20ms
          const scrollResult = await makeRequestDeepScroll(curlCommand, _scrollId);
          if (!resAdd(res, scrollResult)) {
            console.log("over---")
            break;
          }
        } catch (error) {
          console.error('Scroll error:', error);
          outputDiv.textContent = `Scroll error: ${error.message}`;
          break;
        }
      }

      globalRes = res; // 将结果存储在全局变量中
      
      // 如果不保存文件则显示结果
      if (!document.getElementById('save-file').checked) {
        outputDiv.textContent = JSON.stringify(globalRes, null, 2);
      } else {
        outputDiv.textContent = '处理完成，结果已保存';
        // 自动保存逻辑
        const saveCheckbox = document.getElementById('save-file');
        if (saveCheckbox.checked && globalRes.length > 0) {
          try {
            const output = JSON.stringify(globalRes, null, 2);
            const blob = new Blob([output], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'output.txt';
            document.body.appendChild(a);
            a.click();
            
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            outputDiv.textContent = '处理完成，结果已保存';
          } catch (error) {
            outputDiv.textContent = '保存失败: ' + error.message;
          }
        }

      }
    } catch (error) {
      outputDiv.textContent = `Error: ${error.message}`;
    } finally {
      isRunning = false;
      convertBtn.textContent = 'Convert & Execute';
      convertBtn.disabled = false;
  }

  });

  // Add copy button functionality
  document.getElementById('copy-btn').addEventListener('click', () => {
    const output = document.getElementById('output').textContent;
    if (output) {
      navigator.clipboard.writeText(output)
        .then(() => console.log('Content copied to clipboard'))
        .catch(err => console.error('Failed to copy:', err));
    } else {
      console.log('No content to copy');
    }
  });
})

async function resAdd(res, result) {
  // Get custom processor if provided
  const customProcessor = document.getElementById('custom-processor').value.trim();

  if (result.hits.hits.length == 0) {
    return false
  }

  let dealRes = []

  for (const item of result.hits.hits) {
    let logmsg
    if (item._source) {
      logmsg = item._source.logmsg
    } else {
      logmsg = item.fields['logmsg'][0];
    }
    if (logmsg) {

      if (customProcessor) {
        // 使用正则对logmsg
        try {
          const regex = new RegExp(customProcessor, 'g')
          const matches = [...logmsg.matchAll(regex)];
          if (matches.length > 0) {
            matches.forEach(match => {
              dealRes.push(match[1]);
            });
          }
        } catch (error) {
          outputDiv.textContent = `Error: ${error.message}`;
        }
      } else {
        dealRes.push(logmsg);
      }
    }
  }
  // 如果有结果接收地址，发送POST请求
  const resultUrl = document.getElementById('result-url').value.trim();
  if (resultUrl && dealRes) {
    try {
      const response = await fetch(resultUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dealRes)
      });
      if (!response.ok) {
        console.error('Failed to send results:', response.status);
      }
      // response
      dealRes =  await response.json();
      
    } catch (error) {
      console.error('Error sending results:', error);
    }
  }
  res.push(...dealRes);
  return true;
}
