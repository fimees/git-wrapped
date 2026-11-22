'use strict';

module.exports = {
  ...require('./collect'),
  ...require('./analyze'),
  ...require('./render-terminal'),
  ...require('./render-svg'),
  ...require('./render-html'),
};
