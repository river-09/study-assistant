/**
 * Splits `items` into groups of at most `size`, keeping the original order.
 *   batch([1, 2, 3, 4, 5], 2)  ->  [[1, 2], [3, 4], [5]]
 *   batch([], 3)               ->  []
 * Throws if size is not a whole number of at least 1.
 *
 * <T> is a generic: it works for an array of anything (numbers, strings,
 * chunks), and TypeScript knows the groups contain that same type.
 */
export function batch<T>(items: T[], size: number): T[][] {
  if  (!Number.isInteger(size) || size<1){
    throw new Error(`batch size must be a whole number of at least 1, got ${size}`);
  }
  const b: T[][]=[];
  for(let i=0; i<items.length; i+=size){
    const arr:T[]=[];
    for(let j=i; j<i+size && j<items.length;j++)arr.push(items[j]);
    b.push(arr);
  }
  return b;
}
