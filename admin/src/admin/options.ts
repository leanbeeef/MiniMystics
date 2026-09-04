import { AdminJSOptions } from 'adminjs';

import componentLoader from './component-loader.js';
import { resources } from './resources.js';

const options: AdminJSOptions = {
  componentLoader,
  rootPath: '/admin',
  resources,
  branding: {
    companyName: 'Mini Mystics Operations',
    withMadeWithLove: false,
  },
};

export default options;
