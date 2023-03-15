export const getHashCode = (obj: Object): number => getHashNumber(JSON.stringify(obj, replacer));

function replacer(key: string, value: any) {
  if(value instanceof Map) {
    return {
        map: Array.from(value.entries()),
    };
  } else {
    return value;
  }
}

function getHashNumber(str: string) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + code;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

export const filterUndefined = <T>(x: T | undefined): x is T => x !== undefined;