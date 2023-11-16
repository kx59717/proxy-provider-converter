const YAML = require("yaml");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  const url = req.query.url;
  const filter = req.query.filter;
  let configFile = null;
  try {
    const result = await axios({
      url,
      headers: {
        "User-Agent":
          "ClashX Pro/1.72.0.4 (com.west2online.ClashXPro; build:1.72.0.4; macOS 12.0.1) Alamofire/5.4.4",
      }
    });
    configFile = result.data;
  } catch (error) {
    console.log(error, 'error')
    res.status(400).send(`Unable to get url, error: ${error}`);
    return;
  }

  console.log(`Parsing YAML`);
  let config = null;
  try {
    config = YAML.parse(configFile);
    console.log(`👌 Parsed YAML`);
  } catch (error) {
    console.log(error, 'error')
    res.status(500).send(`Unable parse config, error: ${error}`);
    return;
  }

  const filterArray = filter.split(',').map((f) => f.trim())
  const proxies = config.proxies.filter((proxy) => {
    if (filterArray.length === 0) {
      return true
    }
    return !filterArray.some((f) => proxy.name.includes(f))
  });

  const templateYaml = fs.readFileSync(path.resolve(process.cwd(), 'assets/kimi.yaml'), 'utf8');
  const configFinalFile = YAML.parse(templateYaml);
  // 替换proxies
  configFinalFile.proxies = proxies;

  // 按国家分组
  const countries = []
  configFinalFile.proxies.forEach((proxy) => {
    if (/\|.*-.*/.test(proxy.name)) {
      const country = proxy.name.split('-')[0];
      if (!countries.includes(country)) {
        countries.push(country);
      }
    }
  })
  // res.status(200).send(YAML.stringify(countries));
  // proxy group 循环替换country
  configFinalFile['proxy-groups'].forEach(i => {
    // 按组选择的部分
    const external = ['手动选择', '国内流量', '国外流量']
     let flag = external.some(j => i.name.includes(j))
     if (!flag && i.type === 'select') {
       i.proxies = countries.concat(['🚀 国外流量', '🎯 国内流量', '♻️ 自动选择', '🚀 手动选择1', '🚀 手动选择2'])
     }
     // 手动选择部分
     const manual = ['手动选择', '自动选择']
     let manulFlag = manual.some(j => i.name.includes(j))
     if (manulFlag) {
       i.proxies = configFinalFile.proxies.filter((proxy) => {
        if (/\|.*-.*/.test(proxy.name)) return proxy.name
      }).map((proxy) => proxy.name)
     }
     // 国外流量
     if (i.name.includes('国外流量')) {
      i.proxies = countries.concat(['♻️ 自动选择', '🚀 手动选择1', '🚀 手动选择2'])
     }
  })
  // 国家
  countries.forEach((country) => {
    configFinalFile['proxy-groups'].push({
      name: country,
      type: 'url-test',
      url: 'https://i.ytimg.com/generate_204',
      interval: 300,
      tolerance: 50,
      proxies: configFinalFile.proxies.filter((proxy) => {
        if (proxy.name.includes(country)) return proxy.name
      }).map((proxy) => proxy.name)
    })
  })

  const newResponse = JSON.parse(JSON.stringify(configFinalFile));
  const response = YAML.stringify(newResponse);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(response);
};
