# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: run_3f63fd91-3991-4463-ba5f-773e64591c39.spec.ts >> Automation Run 3f63fd91-3991-4463-ba5f-773e64591c39 >> 3f63fd91-3991-4463-ba5f-773e64591c39:6c60dbd0-8e34-4ab1-93ae-e3830be5aa93:click on PIM
- Location: temp_tests/run_3f63fd91-3991-4463-ba5f-773e64591c39.spec.ts:225:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: One or more UI steps failed.
```

# Test source

```ts
  242 |         case 'label':
  243 |           return page.getByLabel(sel);
  244 |         case 'xpath':
  245 |           return page.locator('xpath=' + sel);
  246 |         default:
  247 |           return page.locator(sel);
  248 |       }
  249 |     };
  250 |     const startUrl = buildUrl(rawPath);
  251 |     const stepResults = [];
  252 |     let testFailed = false;
  253 |     let errorMsg: string | null = null;
  254 | 
  255 |     const startedAt = Date.now();
  256 |     let flatSteps: any[] = [];
  257 |     try {
  258 |       await page.goto(startUrl);
  259 |       flatSteps = flattenSteps(steps);
  260 | 
  261 |       for (const [index, step] of flatSteps.entries()) {
  262 |         const action = step.action;
  263 |         const selector = step.selector ? resolveVariables(step.selector, runVariables) : '';
  264 |         const value = step.value ? resolveVariables(step.value, runVariables) : '';
  265 |         const variableName = step.variableName || '';
  266 |         const label = step.label || `${index + 1}. ${action}`;
  267 |         let actualValue: any = null;
  268 | 
  269 |         try {
  270 |           const locator = getLocator(page, step);
  271 |           if (action === 'goto') {
  272 |             await page.goto(buildUrl(value || rawPath));
  273 |             actualValue = page.url();
  274 |           } else if (action === 'click') {
  275 |             await locator.click();
  276 |           } else if (action === 'fill') {
  277 |             await locator.fill(value);
  278 |           } else if (action === 'select') {
  279 |             await locator.selectOption(value);
  280 |           } else if (action === 'check') {
  281 |             await locator.check();
  282 |           } else if (action === 'uncheck') {
  283 |             await locator.uncheck();
  284 |           } else if (action === 'wait_for_selector') {
  285 |             await locator.waitFor({ state: 'visible' });
  286 |           } else if (action === 'expect_visible') {
  287 |             await expect(locator).toBeVisible();
  288 |           } else if (action === 'expect_text') {
  289 |             await expect(locator).toContainText(value);
  290 |             actualValue = await locator.innerText().catch(() => null);
  291 |           } else if (action === 'expect_url') {
  292 |             await expect(page).toHaveURL(new RegExp(value));
  293 |             actualValue = page.url();
  294 |           } else if (action === 'extract_text') {
  295 |             actualValue = await locator.innerText();
  296 |             if (variableName) runVariables[variableName] = String(actualValue);
  297 |           } else if (action === 'screenshot') {
  298 |             await testInfo.attach(value || `screenshot-${index + 1}`, {
  299 |               body: await page.screenshot({ fullPage: true }),
  300 |               contentType: 'image/png'
  301 |             });
  302 |           } else {
  303 |             throw new Error(`Unsupported UI action: ${action}`);
  304 |           }
  305 | 
  306 |           stepResults.push({ type: 'ui_step', action, label, selector, expected: value, actual: actualValue, passed: true });
  307 |         } catch (e: any) {
  308 |           testFailed = true;
  309 |           stepResults.push({
  310 |             type: 'ui_step',
  311 |             action,
  312 |             label,
  313 |             selector,
  314 |             expected: value,
  315 |             actual: actualValue,
  316 |             passed: false,
  317 |             error: e.message || String(e)
  318 |           });
  319 |           break;
  320 |         }
  321 |       }
  322 |     } catch (e: any) {
  323 |       testFailed = true;
  324 |       errorMsg = e.message || String(e);
  325 |     }
  326 | 
  327 |     await testInfo.attach('request_response', {
  328 |       contentType: 'application/json',
  329 |       body: JSON.stringify({
  330 |         request: { method: 'UI', url: startUrl, headers: {}, body: JSON.stringify(flatSteps) },
  331 |         response: { status: 0, headers: {}, body: JSON.stringify({ url: page.url(), title: await page.title().catch(() => '') }) },
  332 |         error: errorMsg
  333 |       })
  334 |     });
  335 | 
  336 |     await testInfo.attach('assertions', {
  337 |       contentType: 'application/json',
  338 |       body: JSON.stringify(stepResults)
  339 |     });
  340 | 
  341 |     if (testFailed) {
> 342 |       throw new Error(errorMsg || 'One or more UI steps failed.');
      |             ^ Error: One or more UI steps failed.
  343 |     }
  344 |   });
  345 | 
  346 | });
  347 | 
```