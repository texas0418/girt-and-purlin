// The program was first named Girt And Purlin. What a device saved under that
// name is carried over once, so no job, price list or trial day is lost.
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('girt-and-purlin.')) continue;
    const now = key.replace('girt-and-purlin.', 'ridge-and-rafter.');
    // A code made under the old name does not pass under the new one, so it is not carried.
    if (localStorage.getItem(now) === null && !key.includes('.license.')) localStorage.setItem(now, localStorage.getItem(key));
    localStorage.removeItem(key);
  }
} catch { /* storage is off */ }
