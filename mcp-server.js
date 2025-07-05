#!/usr/bin/env node

/**
 * Custom MCP server for ScreenshotOS testing
 * This provides a bridge between Claude and the Electron app for testing
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { ElectronAppHelper } = require('./tests/e2e/electron-helper.js');

class ScreenshotOSMCPServer {
  constructor() {
    this.appHelper = null;
    this.server = new Server(
      {
        name: 'screenshotos-test',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'launch_app',
            description: 'Launch the ScreenshotOS Electron app',
            inputSchema: {
              type: 'object',
              properties: {
                options: {
                  type: 'object',
                  description: 'Launch options (optional)',
                  properties: {
                    headless: { type: 'boolean', default: false }
                  }
                }
              }
            }
          },
          {
            name: 'take_screenshot',
            description: 'Take a screenshot of the app',
            inputSchema: {
              type: 'object',
              properties: {
                filename: {
                  type: 'string',
                  description: 'Filename for the screenshot (without extension)'
                }
              },
              required: ['filename']
            }
          },
          {
            name: 'click_element',
            description: 'Click an element in the app',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for the element to click'
                }
              },
              required: ['selector']
            }
          },
          {
            name: 'wait_for_element',
            description: 'Wait for an element to appear',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for the element to wait for'
                },
                timeout: {
                  type: 'number',
                  description: 'Timeout in milliseconds',
                  default: 5000
                }
              },
              required: ['selector']
            }
          },
          {
            name: 'get_text',
            description: 'Get text content of an element',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for the element'
                }
              },
              required: ['selector']
            }
          },
          {
            name: 'is_visible',
            description: 'Check if an element is visible',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for the element'
                }
              },
              required: ['selector']
            }
          },
          {
            name: 'wait_for_screenshots_loaded',
            description: 'Wait for the app to finish loading screenshots',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_screenshot_info',
            description: 'Get information about loaded screenshots',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'close_app',
            description: 'Close the ScreenshotOS app',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'launch_app':
            if (this.appHelper) {
              await this.appHelper.close();
            }
            this.appHelper = new ElectronAppHelper();
            await this.appHelper.launch(args?.options || {});
            return {
              content: [
                {
                  type: 'text',
                  text: '✅ ScreenshotOS app launched successfully'
                }
              ]
            };

          case 'take_screenshot':
            if (!this.appHelper) {
              throw new Error('App not launched. Use launch_app first.');
            }
            const screenshotPath = await this.appHelper.takeScreenshot(args.filename);
            return {
              content: [
                {
                  type: 'text',
                  text: `📸 Screenshot saved: ${screenshotPath}`
                }
              ]
            };

          case 'click_element':
            if (!this.appHelper) {
              throw new Error('App not launched. Use launch_app first.');
            }
            await this.appHelper.click(args.selector);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Clicked element: ${args.selector}`
                }
              ]
            };

          case 'wait_for_element':
            if (!this.appHelper) {
              throw new Error('App not launched. Use launch_app first.');
            }
            await this.appHelper.waitForElement(args.selector, args.timeout || 5000);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Element found: ${args.selector}`
                }
              ]
            };

          case 'get_text':
            if (!this.appHelper) {
              throw new Error('App not launched. Use launch_app first.');
            }
            const text = await this.appHelper.getText(args.selector);
            return {
              content: [
                {
                  type: 'text',
                  text: `Text content: "${text}"`
                }
              ]
            };

          case 'is_visible':
            if (!this.appHelper) {
              throw new Error('App not launched. Use launch_app first.');
            }
            const visible = await this.appHelper.isVisible(args.selector);
            return {
              content: [
                {
                  type: 'text',
                  text: `Element visibility: ${visible ? 'visible' : 'not visible'}`
                }
              ]
            };

          case 'wait_for_screenshots_loaded':
            if (!this.appHelper) {
              throw new Error('App not launched. Use launch_app first.');
            }
            await this.appHelper.waitForScreenshotsLoaded();
            return {
              content: [
                {
                  type: 'text',
                  text: '✅ Screenshots loaded'
                }
              ]
            };

          case 'get_screenshot_info':
            if (!this.appHelper) {
              throw new Error('App not launched. Use launch_app first.');
            }
            const screenshots = await this.appHelper.getScreenshotInfo();
            return {
              content: [
                {
                  type: 'text',
                  text: `📊 Found ${screenshots.length} screenshots:\n${screenshots.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.date}) ${s.isSelected ? '[SELECTED]' : ''}`).join('\n')}${screenshots.length > 5 ? `\n... and ${screenshots.length - 5} more` : ''}`
                }
              ]
            };

          case 'close_app':
            if (this.appHelper) {
              await this.appHelper.close();
              this.appHelper = null;
            }
            return {
              content: [
                {
                  type: 'text',
                  text: '✅ App closed'
                }
              ]
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('ScreenshotOS MCP server running');
  }
}

// Run the server
const server = new ScreenshotOSMCPServer();
server.run().catch(console.error);

module.exports = { ScreenshotOSMCPServer };