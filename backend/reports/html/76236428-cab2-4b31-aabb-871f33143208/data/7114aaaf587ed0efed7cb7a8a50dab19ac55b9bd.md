# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: temp_tests/run_76236428-cab2-4b31-aabb-871f33143208.spec.ts >> Automation Run 76236428-cab2-4b31-aabb-871f33143208 >> 76236428-cab2-4b31-aabb-871f33143208:a11bbe49-bd77-4bbb-81b4-c8de4776bc16:login to falconride app
- Location: temp_tests/run_76236428-cab2-4b31-aabb-871f33143208.spec.ts:63:7

# Error details

```
ReferenceError: steps is not defined
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: Swag Labs
  - generic [ref=e5]:
    - generic [ref=e9]:
      - textbox "Username" [ref=e11]
      - textbox "Password" [ref=e13]
      - button "Login" [ref=e15] [cursor=pointer]
    - generic [ref=e17]:
      - generic [ref=e18]:
        - heading "Accepted usernames are:" [level=4] [ref=e19]
        - text: standard_user
        - text: locked_out_user
        - text: problem_user
        - text: performance_glitch_user
        - text: error_user
        - text: visual_user
      - generic [ref=e20]:
        - heading "Password for all users:" [level=4] [ref=e21]
        - text: secret_sauce
```

# Test source

```ts
  65  |     const getLocator = (page: any, step: any) => {
  66  |       const type = step.locatorType || 'css';
  67  |       const sel = step.selector || '';
  68  |       switch (type) {
  69  |         case 'css':
  70  |           return page.locator(sel);
  71  |         case 'text':
  72  |           return page.getByText(sel);
  73  |         case 'role':
  74  |           return page.getByRole(sel);
  75  |         case 'testId':
  76  |           return page.getByTestId(sel);
  77  |         case 'placeholder':
  78  |           return page.getByPlaceholder(sel);
  79  |         case 'label':
  80  |           return page.getByLabel(sel);
  81  |         case 'xpath':
  82  |           return page.locator('xpath=' + sel);
  83  |         default:
  84  |           return page.locator(sel);
  85  |       }
  86  |     };
  87  |     const startUrl = buildUrl(rawPath);
  88  |     const stepResults = [];
  89  |     let testFailed = false;
  90  |     let errorMsg: string | null = null;
  91  | 
  92  |     const startedAt = Date.now();
  93  |     try {
  94  |       await page.goto(startUrl);
  95  | 
  96  |       for (const [index, step] of steps.entries()) {
  97  |         const action = step.action;
  98  |         const selector = step.selector ? resolveVariables(step.selector, runVariables) : '';
  99  |         const value = step.value ? resolveVariables(step.value, runVariables) : '';
  100 |         const variableName = step.variableName || '';
  101 |         const label = step.label || `${index + 1}. ${action}`;
  102 |         let actualValue: any = null;
  103 | 
  104 |         try {
  105 |           const locator = getLocator(page, step);
  106 |           if (action === 'goto') {
  107 |             await page.goto(buildUrl(value || rawPath));
  108 |             actualValue = page.url();
  109 |           } else if (action === 'click') {
  110 |             await locator.click();
  111 |           } else if (action === 'fill') {
  112 |             await locator.fill(value);
  113 |           } else if (action === 'select') {
  114 |             await locator.selectOption(value);
  115 |           } else if (action === 'check') {
  116 |             await locator.check();
  117 |           } else if (action === 'uncheck') {
  118 |             await locator.uncheck();
  119 |           } else if (action === 'wait_for_selector') {
  120 |             await locator.waitFor({ state: 'visible' });
  121 |           } else if (action === 'expect_visible') {
  122 |             await expect(locator).toBeVisible();
  123 |           } else if (action === 'expect_text') {
  124 |             await expect(locator).toContainText(value);
  125 |             actualValue = await locator.innerText().catch(() => null);
  126 |           } else if (action === 'expect_url') {
  127 |             await expect(page).toHaveURL(new RegExp(value));
  128 |             actualValue = page.url();
  129 |           } else if (action === 'extract_text') {
  130 |             actualValue = await locator.innerText();
  131 |             if (variableName) runVariables[variableName] = String(actualValue);
  132 |           } else if (action === 'screenshot') {
  133 |             await testInfo.attach(value || `screenshot-${index + 1}`, {
  134 |               body: await page.screenshot({ fullPage: true }),
  135 |               contentType: 'image/png'
  136 |             });
  137 |           } else {
  138 |             throw new Error(`Unsupported UI action: ${action}`);
  139 |           }
  140 | 
  141 |           stepResults.push({ type: 'ui_step', action, label, selector, expected: value, actual: actualValue, passed: true });
  142 |         } catch (e: any) {
  143 |           testFailed = true;
  144 |           stepResults.push({
  145 |             type: 'ui_step',
  146 |             action,
  147 |             label,
  148 |             selector,
  149 |             expected: value,
  150 |             actual: actualValue,
  151 |             passed: false,
  152 |             error: e.message || String(e)
  153 |           });
  154 |           break;
  155 |         }
  156 |       }
  157 |     } catch (e: any) {
  158 |       testFailed = true;
  159 |       errorMsg = e.message || String(e);
  160 |     }
  161 | 
  162 |     await testInfo.attach('request_response', {
  163 |       contentType: 'application/json',
  164 |       body: JSON.stringify({
> 165 |         request: { method: 'UI', url: startUrl, headers: {}, body: JSON.stringify(steps) },
      |                                                                                   ^ ReferenceError: steps is not defined
  166 |         response: { status: 0, headers: {}, body: JSON.stringify({ url: page.url(), title: await page.title().catch(() => '') }) },
  167 |         error: errorMsg
  168 |       })
  169 |     });
  170 | 
  171 |     await testInfo.attach('assertions', {
  172 |       contentType: 'application/json',
  173 |       body: JSON.stringify(stepResults)
  174 |     });
  175 | 
  176 |     if (testFailed) {
  177 |       throw new Error(errorMsg || 'One or more UI steps failed.');
  178 |     }
  179 |   });
  180 | 
  181 | });
  182 | 
```