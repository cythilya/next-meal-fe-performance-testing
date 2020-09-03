const fs = require('fs');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const TableBuilder = require('table-builder');
const reportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
const config = require('../config.js');
const TEST_PAGES = require('../test_pages.js');
const context = [];
const ENV = context['env'] === 'DEV' ? config.host.dev : config.host.prod;

process.argv.forEach((string) => {
  let key = string.replace(/^--(.*)=.*/, '$1');
  let value = string.replace(/^--.*=(.*)/, '$1');
  switch (key) {
    case 'env':
      context[key] = value;
      break;
  }
});

(async () => {
  let browser = null;
  let page = null;

  try {
    browser = await navigateToIndex();
    page = (await browser.pages())[0];
    const records = [];

    console.log('Running Lighthouse...');

    for (let i = 0; i < TEST_PAGES.length; i += 1) {
      const report = await lighthouse(`${ENV}${TEST_PAGES[i].link}`, {
        port: (new URL(browser.wsEndpoint())).port,
        output: 'json',
        logLevel: 'info',
        emulatedFormFactor: 'desktop',
        throttlingMethod: 'provided',
        // disableDeviceEmulation: true,
        chromeFlags: ['--disable-device-emulation=true', '--emulated-form-factor="desktop"']
      });
      const json = reportGenerator.generateReport(report.lhr, 'json');
      const html = reportGenerator.generateReport(report.lhr, 'html');
      const categories = Object.values(report.lhr.categories);
      const record = {};

      console.log(`Review results for ${TEST_PAGES[i].id}...`);
      record[
        'Page'
      ] = `<a href='./lighthouse-results-${TEST_PAGES[i].id}.html' target='blank'>${TEST_PAGES[i].id}</a>`;

      for (let i = 0; i < categories.length; i += 1) {
        const key = `${categories[i].title}`;
        record[key] = categories[i].score;
        console.log(`Lighthouse scores: ${categories[i].title} ${categories[i].score}`);
      }

      records.push(record);

      console.log('Writing results...');
      fs.writeFileSync(`reports/lighthouse-results-${TEST_PAGES[i].id}.json`, json);
      fs.writeFileSync(`reports/lighthouse-results-${TEST_PAGES[i].id}.html`, html);
    }

    const headers = {
      Page: 'Page',
      Performance: 'Performance',
      Accessibility: 'Accessibility',
      'Best Practices': 'Best Practices',
      SEO: 'SEO',
      'Progressive Web App': 'Progressive Web App',
    };

    const table = new TableBuilder({ class: 'repor-table' })
      .setHeaders(headers) // see above json headers section
      .setData(records) // see above json data section
      .render();

    fs.writeFileSync(`reports/index.html`, table);

    console.log('Done!');
  } catch (error) {
    console.error('Error!', error);
  } finally {
    await page.close();
    await browser.close();
  }
})();

async function navigateToIndex() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to index...');
  await page.goto(ENV);

  console.log('Starting login, entering username and password...');
  await page.click('#login');
  await page.type('#account', 'test');
  await page.type('#password', 'test');
  await page.click('#submit'), console.log('Login success!');
  return browser;
}
