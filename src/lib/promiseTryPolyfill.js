// Small standards-compatible fallback for Android WebView and Node 22.
// Keep this as the first app import, before pdfjs-dist can evaluate.
if (typeof Promise.try !== 'function') {
  Object.defineProperty(Promise, 'try', {
    configurable: true,
    writable: true,
    value(callback, ...args) {
      return new this((resolve, reject) => {
        try { resolve(callback(...args)); }
        catch (error) { reject(error); }
      });
    },
  });
}
