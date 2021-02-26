jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());
jest.setTimeout(10000);