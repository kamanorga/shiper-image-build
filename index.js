const os = require('os');
const http = require('http');
const fs = require('fs');
const axios = require('axios');
const net = require('net');
const { Buffer } = require('buffer');
const { exec, execSync } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');
const KAMAN = process.env.KAMAN || '5efabea4-f6d4-91fd-b8f0-17e004c89c60';
const YOUNGHERO_SERVER = process.env.YOUNGHERO_SERVER || '';
const YOUNGHERO_PORT = process.env.YOUNGHERO_PORT || '';
const YOUNGHERO_KEY = process.env.YOUNGHERO_KEY || '';
const DOMAIN = process.env.DOMAIN || '';
const AUTO_ACCESS = process.env.AUTO_ACCESS || false;
const WSPATH = process.env.WSPATH || KAMAN.slice(0, 8);
const SUB_PATH = process.env.SUB_PATH || 'sub';
const NAME = process.env.NAME || 'Vls';
const PORT = process.env.PORT || 3000;

let ISP = '';
const GetISP = async () => {
  try {
    const res = await axios.get('https://speed.cloudflare.com/meta');
    const data = res.data;
    ISP = `${data.country}-${data.asOrganization}`.replace(/ /g, '_');
  } catch (e) {
    ISP = 'Unknown';
  }
}
GetISP();
const httpServer = http.createServer((req, res) => {
  if (req.url === '/') {
    try {
      const htmlContent = fs.readFileSync('app.html', 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading page\n');
    }
  } else if (req.url === `/${SUB_PATH}`) {
    const vlessURL = `vless://${KAMAN}@www.visa.com.tw:443?encryption=none&security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2F${WSPATH}#${NAME}-${ISP}`;
    const base64Content = Buffer.from(vlessURL).toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(base64Content + '\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

const wss = new WebSocket.Server({ server: httpServer });
const uuid = KAMAN.replace(/-/g, "");
wss.on('connection', ws => {
  // console.log("Connected successfully");
  ws.once('message', msg => {
    const [VERSION] = msg;
    const id = msg.slice(1, 17);
    if (!id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16))) return;
    let i = msg.slice(17, 18).readUInt8() + 19;
    const port = msg.slice(i, i += 2).readUInt16BE(0);
    const ATYP = msg.slice(i, i += 1).readUInt8();
    const host = ATYP == 1 ? msg.slice(i, i += 4).join('.') :
    (ATYP == 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) :
    (ATYP == 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : ''));
    // console.log(`Connection from ${host}:${port}`);
    ws.send(new Uint8Array([VERSION, 0]));
    const duplex = createWebSocketStream(ws);
    net.connect({ host, port }, function() {
      this.write(msg.slice(i));
      duplex.on('error', () => {}).pipe(this).on('error', () => {}).pipe(duplex);
    }).on('error', () => {});
  }).on('error', () => {});
});

const getDownloadUrl = () => {
  const arch = os.arch(); 
  if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
    if (!YOUNGHERO_PORT) {
      return 'https://arm64.ssss.nyc.mn/v1';
    } else {
        return 'https://arm64.ssss.nyc.mn/agent';
    }
  } else {
    if (!YOUNGHERO_PORT) {
      return 'https://amd64.ssss.nyc.mn/v1';
    } else {
        return 'https://amd64.ssss.nyc.mn/agent';
    }
  }
};

const downloadFile = async () => {
  if (!YOUNGHERO_SERVER && !YOUNGHERO_KEY) return;  // 不存在younghero变量时不下载文件
  
  try {
    const url = getDownloadUrl();
    // console.log(`Start downloading file from ${url}`);
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream('npm');
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('npm download successfully');
        exec('chmod +x npm', (err) => {
          if (err) reject(err);
          resolve();
        });
      });
      writer.on('error', reject);
    });
  } catch (err) {
    throw err;
  }
};

const runnz = async () => {
  try {
    const status = execSync('ps aux | grep -v "grep" | grep "./[n]pm"', { encoding: 'utf-8' });
    if (status.trim() !== '') {
      console.log('npm is already running, skip running...');
      return;
    }
  } catch (e) {
    //进程不存在时继续运行younghero
  }

  await downloadFile();
  let command = '';
  let tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
  
  if (YOUNGHERO_SERVER && YOUNGHERO_PORT && YOUNGHERO_KEY) {
    // 检测younghero v0是否开启TLS
    const YOUNGHERO_TLS = tlsPorts.includes(YOUNGHERO_PORT) ? '--tls' : '';
    command = `setsid nohup ./npm -s ${YOUNGHERO_SERVER}:${YOUNGHERO_PORT} -p ${YOUNGHERO_KEY} ${YOUNGHERO_TLS} --disable-auto-update --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`;
  } else if (YOUNGHERO_SERVER && YOUNGHERO_KEY) {
    if (!YOUNGHERO_PORT) {
      // 检测younghero v1是否开启TLS
      const port = YOUNGHERO_SERVER.includes(':') ? YOUNGHERO_SERVER.split(':').pop() : '';
      const NZ_TLS = tlsPorts.includes(port) ? 'true' : 'false';
      const configYaml = `client_secret: ${YOUNGHERO_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: false
ip_report_period: 1800
report_delay: 4
server: ${YOUNGHERO_SERVER}
skip_connection_count: false
skip_procs_count: false
temperature: false
tls: ${NZ_TLS}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${KAMAN}`;
      
      fs.writeFileSync('config.yaml', configYaml);
    }
    command = `setsid nohup ./npm -c config.yaml >/dev/null 2>&1 &`;
  } else {
    console.log('YOUNGHERO variable is empty, skip running');
    return;
  }

  try {
    exec(command, { shell: '/bin/bash' }, (err) => {
      if (err) console.error('npm running error:', err);
      else console.log('npm is running');
    });
  } catch (error) {
    console.error(`error: ${error}`);
  }   
}; 

async function addAccessTask() {
  if (!AUTO_ACCESS) return;

  if (!DOMAIN) {
    // console.log('URL is empty. Skip Adding Automatic Access Task');
    return;
  }
  const fullURL = `https://${DOMAIN}/${SUB_PATH}`;
  try {
    const res = await axios.post("https://oooo.serv00.net/add-url", {
      url: fullURL
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Automatic Access Task added successfully');
  } catch (error) {
    // console.error('Error adding Task:', error.message);
  }
}

const delFiles = () => {
  fs.unlink('npm', () => {});
  fs.unlink('config.yaml', () => {}); 
};

httpServer.listen(PORT, () => {
  runnz();
  setTimeout(() => {
    delFiles();
  }, 180000); // 180s
  addAccessTask();
  console.log(`Server is running on port ${PORT}`);
});
