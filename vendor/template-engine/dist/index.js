'use strict';

var jp = require('jsonpath');
var traverse = require('traverse');
var browserOrNode = require('browser-or-node');
var os = require('os');
var concertoCore = require('@accordproject/concerto-core');
var dayjs = require('dayjs');
var utc = require('dayjs/plugin/utc');
var toWords = require('to-words');
var markdownCommon = require('@accordproject/markdown-common');
var vfs = require('@typescript/vfs');
var twoslash = require('@typescript/twoslash');
var concertoCodegen = require('@accordproject/concerto-codegen');
var concertoUtil = require('@accordproject/concerto-util');
var markdownTemplate = require('@accordproject/markdown-template');
var fs = require('fs');
var lzstring = require('lz-string');
var child_process = require('child_process');
var path = require('path');
var markdownTransform = require('@accordproject/markdown-transform');
var typescript = require('typescript');
var webpack = require('webpack');
var memfs = require('memfs');
var unionfs = require('unionfs');
var linkfs = require('linkfs');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var lzstring__namespace = /*#__PURE__*/_interopNamespaceDefault(lzstring);

function booleanDrafter(value) {
  if (value) {
    return "true";
  } else {
    return "false";
  }
}

dayjs.extend(utc);
function dateTimeDrafter(value, format) {
  const f = format ? format : "MM/DD/YYYY";
  return dayjs.utc(value).format(f);
}

function draftDoubleIEEE(value) {
  if (Math.floor(value) === value) {
    return new Number(value).toFixed(1);
  } else {
    return "" + value;
  }
}
function draftDoubleFormat(value, format) {
  if (format === "text") {
    const converter = new toWords.ToWords();
    const res = converter.convert(value);
    return res;
  } else {
    return format.replace(/0(.)0((.)(0+))?/gi, function(_a, sep1, _b, sep2, digits) {
      const len = digits ? digits.length : 0;
      const vs = value.toFixed(len);
      let res = "";
      if (sep2) {
        const d = vs.substring(vs.length - len);
        res += sep2 + d;
      }
      let i = vs.substring(0, vs.length - (len === 0 ? 0 : len + 1));
      while (i.length > 3) {
        res = sep1 + i.substring(i.length - 3) + res;
        i = i.substring(0, i.length - 3);
      }
      return i + res;
    });
  }
}

function doubleDrafter(value, format) {
  if (format) {
    return draftDoubleFormat(value, format);
  } else {
    return draftDoubleIEEE(value);
  }
}

function draftInteger(value) {
  return "" + value;
}
function draftIntegerFormat(value, format) {
  if (format === "text") {
    const converter = new toWords.ToWords();
    const res = converter.convert(value);
    return res;
  } else {
    return format.replace(/0(.)0/gi, function(_a, sep1) {
      const vs = value.toFixed(0);
      let res = "";
      let i = vs.substring(0, vs.length);
      while (i.length > 3) {
        res = sep1 + i.substring(i.length - 3) + res;
        i = i.substring(0, i.length - 3);
      }
      return i + res;
    });
  }
}

function integerDrafter(value, format) {
  if (format) {
    return draftIntegerFormat(value, format);
  } else {
    return draftInteger(value);
  }
}

function isDuration(value) {
  return value != null && typeof value === "object" && "amount" in value && "unit" in value && typeof value.amount === "number" && typeof value.unit === "string";
}
function durationDrafter(value) {
  if (!isDuration(value)) {
    return "0 unknown";
  }
  return `${value.amount} ${value.unit}`;
}

function longDrafter(value, format) {
  if (format) {
    return draftIntegerFormat(value, format);
  } else {
    return draftInteger(value);
  }
}

var CurrencyCode = /* @__PURE__ */ ((CurrencyCode2) => {
  CurrencyCode2["USD"] = "$";
  CurrencyCode2["EUR"] = "\u20AC";
  CurrencyCode2["JPY"] = "\xA5";
  CurrencyCode2["GBP"] = "\xA3";
  CurrencyCode2["AUD"] = "A$";
  CurrencyCode2["CAD"] = "C$";
  CurrencyCode2["CHF"] = "CHF";
  CurrencyCode2["CNY"] = "\u5143";
  CurrencyCode2["HKD"] = "HK$";
  CurrencyCode2["NZD"] = "NZ$";
  CurrencyCode2["KRW"] = "\u20A9";
  CurrencyCode2["SGD"] = "S$";
  CurrencyCode2["MXN"] = "MEX$";
  CurrencyCode2["INR"] = "\u20B9";
  CurrencyCode2["RUB"] = "\u20BD";
  CurrencyCode2["ZAR"] = "R";
  CurrencyCode2["TRY"] = "\u20BA";
  CurrencyCode2["BRL"] = "R$";
  CurrencyCode2["TWD"] = "NT$";
  CurrencyCode2["PLN"] = "z\u0142";
  CurrencyCode2["THB"] = "\u0E3F";
  CurrencyCode2["IDR"] = "Rp";
  CurrencyCode2["HUF"] = "Ft";
  CurrencyCode2["CZK"] = "K\u010D";
  CurrencyCode2["ILS"] = "\u20AA";
  CurrencyCode2["CLP"] = "CLP$";
  CurrencyCode2["PHP"] = "\u20B1";
  CurrencyCode2["AED"] = "\u062F.\u0625";
  CurrencyCode2["COP"] = "COL$";
  CurrencyCode2["SAR"] = "\uFDFC";
  CurrencyCode2["MYR"] = "RM";
  CurrencyCode2["RON"] = "L";
  CurrencyCode2["BGN"] = "\u043B\u0432.";
  return CurrencyCode2;
})(CurrencyCode || {});

function monetaryAmountDefaultDrafter(value) {
  return "" + draftDoubleIEEE(value.doubleValue) + " " + value.currencyCode;
}
function codeSymbol(c) {
  const index = Object.keys(CurrencyCode).indexOf(c);
  if (index >= 0) {
    return Object.values(CurrencyCode)[index];
  } else {
    return c;
  }
}
function monetaryAmountFormatDrafter(value, format) {
  return draftDoubleFormat(
    value.doubleValue,
    format.replace(/K/gi, codeSymbol(value.currencyCode)).replace(/CCC/gi, value.currencyCode)
  );
}
function monetaryAmountDrafter(value, format) {
  if (format) {
    return monetaryAmountFormatDrafter(value, format);
  } else {
    return monetaryAmountDefaultDrafter(value);
  }
}

function stringDrafter(value) {
  return value;
}

function getDrafter(typeName) {
  switch (typeName) {
    case "Boolean":
      return booleanDrafter;
    case "DateTime":
      return dateTimeDrafter;
    case "Double":
      return doubleDrafter;
    case "Integer":
      return integerDrafter;
    case "Long":
      return longDrafter;
    case "org.accordproject.money@0.3.0.MonetaryAmount":
      return monetaryAmountDrafter;
    case "org.accordproject.time@0.3.0.Duration":
      return durationDrafter;
    case "org.accordproject.time@0.3.0.Period":
      return durationDrafter;
    case "String":
      return stringDrafter;
    default:
      return null;
  }
}

const TEMPLATEMARK_RE = /^(org\.accordproject\.templatemark)@(.+)\.(\w+)Definition$/;
const FORMULA_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormulaDefinition$/;
const VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.VariableDefinition$/;
const CONDITIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ConditionalDefinition$/;
const ENUM_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.EnumVariableDefinition$/;
const FORMATTED_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormattedVariableDefinition$/;
const WITH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.WithDefinition$/;
const LISTBLOCK_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ListBlockDefinition$/;
const JOIN_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.JoinDefinition$/;
const OPTIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.OptionalDefinition$/;
const CLAUSE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ClauseDefinition$/;
const CONTRACT_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ContractDefinition$/;
const FOREACH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ForeachDefinition$/;
const NAVIGATION_NODES = [
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.ListBlockDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.WithDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.JoinDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.OptionalDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.ContractDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.ForeachBlockDefinition`
];

function ensureDirSync(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}
function removeSync(path) {
  fs.rmSync(path, { recursive: true, force: true });
}
function writeFunctionToString(templateClass, functionName, returnType, code) {
  let result = "";
  result += "/// ---cut---\n";
  result += `export function ${functionName}(data:TemplateModel.I${templateClass.getName()}, library:any, options:GenerationOptions) : ${returnType} {
`;
  result += "   const now = dayjs(options?.now);\n";
  result += "   const locale = options?.locale;\n";
  templateClass.getProperties().forEach((p) => {
    result += `   const ${p.getName()} = data.${p.getName()};
`;
  });
  result += "   " + code.trim() + "\n";
  result += "}\n";
  result += "\n";
  return result;
}
function nameUserCode(templateMarkDom) {
  return traverse(templateMarkDom).map(function(x) {
    if (x && (x.$class === `${markdownCommon.TemplateMarkModel.NAMESPACE}.ConditionalDefinition` && x.condition || x.$class === `${markdownCommon.TemplateMarkModel.NAMESPACE}.ClauseDefinition` && x.condition)) {
      x.functionName = `condition_${this.path.join("_")}`;
    }
    this.update(x);
  });
}
function getTemplateClassDeclaration(modelManager, templateConceptFqn) {
  const introspector = new concertoCore.Introspector(modelManager);
  try {
    return markdownTemplate.templatemarkutil.findTemplateConcept(introspector, "clause", templateConceptFqn);
  } catch (err) {
    console.log(err);
    throw err;
  }
}

class TypeScriptCompilationContext {
  constructor(modelManager, templateConceptFqn) {
    this.modelManager = modelManager;
    this.templateClass = getTemplateClassDeclaration(this.modelManager, templateConceptFqn);
  }
  getTypeScriptFiles() {
    const result = {};
    const visitor = new concertoCodegen.CodeGen.TypescriptVisitor();
    const writer = new concertoUtil.InMemoryWriter();
    const params = {
      fileWriter: writer
    };
    this.modelManager.accept(visitor, params);
    writer.getFilesInMemory().forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  getCompilationContext() {
    const files = this.getTypeScriptFiles();
    let result = "";
    Object.keys(files).forEach((key) => {
      const content = files[key];
      result += `
// @filename: ${key}
${content}
`;
    });
    result += `
// @filename: code.ts
import * as TemplateModel from './${this.templateClass.getNamespace()}';
import dayjs from 'dayjs';
import jp from 'jsonpath';

type GenerationOptions = {
    now?:string,
    locale?:string
}
`;
    return result;
  }
}

const DAYJS_BASE64 = "Ly8vIDxyZWZlcmVuY2UgcGF0aD0iLi9sb2NhbGUvaW5kZXguZC50cyIgLz4KCmV4cG9ydCA9IGRheWpzOwoKZGVjbGFyZSBmdW5jdGlvbiBkYXlqcyAoZGF0ZT86IGRheWpzLkNvbmZpZ1R5cGUpOiBkYXlqcy5EYXlqcwoKZGVjbGFyZSBmdW5jdGlvbiBkYXlqcyAoZGF0ZT86IGRheWpzLkNvbmZpZ1R5cGUsIGZvcm1hdD86IGRheWpzLk9wdGlvblR5cGUsIHN0cmljdD86IGJvb2xlYW4pOiBkYXlqcy5EYXlqcwoKZGVjbGFyZSBmdW5jdGlvbiBkYXlqcyAoZGF0ZT86IGRheWpzLkNvbmZpZ1R5cGUsIGZvcm1hdD86IGRheWpzLk9wdGlvblR5cGUsIGxvY2FsZT86IHN0cmluZywgc3RyaWN0PzogYm9vbGVhbik6IGRheWpzLkRheWpzCgpkZWNsYXJlIG5hbWVzcGFjZSBkYXlqcyB7CiAgaW50ZXJmYWNlIENvbmZpZ1R5cGVNYXAgewogICAgZGVmYXVsdDogc3RyaW5nIHwgbnVtYmVyIHwgRGF0ZSB8IERheWpzIHwgbnVsbCB8IHVuZGVmaW5lZAogIH0KCiAgZXhwb3J0IHR5cGUgQ29uZmlnVHlwZSA9IENvbmZpZ1R5cGVNYXBba2V5b2YgQ29uZmlnVHlwZU1hcF0KCiAgZXhwb3J0IGludGVyZmFjZSBGb3JtYXRPYmplY3QgeyBsb2NhbGU/OiBzdHJpbmcsIGZvcm1hdD86IHN0cmluZywgdXRjPzogYm9vbGVhbiB9CgogIGV4cG9ydCB0eXBlIE9wdGlvblR5cGUgPSBGb3JtYXRPYmplY3QgfCBzdHJpbmcgfCBzdHJpbmdbXQoKICBleHBvcnQgdHlwZSBVbml0VHlwZVNob3J0ID0gJ2QnIHwgJ0QnIHwgJ00nIHwgJ3knIHwgJ2gnIHwgJ20nIHwgJ3MnIHwgJ21zJwoKICBleHBvcnQgdHlwZSBVbml0VHlwZUxvbmcgPSAnbWlsbGlzZWNvbmQnIHwgJ3NlY29uZCcgfCAnbWludXRlJyB8ICdob3VyJyB8ICdkYXknIHwgJ21vbnRoJyB8ICd5ZWFyJyB8ICdkYXRlJwoKICBleHBvcnQgdHlwZSBVbml0VHlwZUxvbmdQbHVyYWwgPSAnbWlsbGlzZWNvbmRzJyB8ICdzZWNvbmRzJyB8ICdtaW51dGVzJyB8ICdob3VycycgfCAnZGF5cycgfCAnbW9udGhzJyB8ICd5ZWFycycgfCAnZGF0ZXMnCiAgCiAgZXhwb3J0IHR5cGUgVW5pdFR5cGUgPSBVbml0VHlwZUxvbmcgfCBVbml0VHlwZUxvbmdQbHVyYWwgfCBVbml0VHlwZVNob3J0OwoKICBleHBvcnQgdHlwZSBPcFVuaXRUeXBlID0gVW5pdFR5cGUgfCAid2VlayIgfCAid2Vla3MiIHwgJ3cnOwogIGV4cG9ydCB0eXBlIFFVbml0VHlwZSA9IFVuaXRUeXBlIHwgInF1YXJ0ZXIiIHwgInF1YXJ0ZXJzIiB8ICdRJzsKICBleHBvcnQgdHlwZSBNYW5pcHVsYXRlVHlwZSA9IEV4Y2x1ZGU8T3BVbml0VHlwZSwgJ2RhdGUnIHwgJ2RhdGVzJz47CiAgY2xhc3MgRGF5anMgewogICAgY29uc3RydWN0b3IgKGNvbmZpZz86IENvbmZpZ1R5cGUpCiAgICAvKioKICAgICAqIEFsbCBEYXkuanMgb2JqZWN0cyBhcmUgaW1tdXRhYmxlLiBTdGlsbCwgYGRheWpzI2Nsb25lYCBjYW4gY3JlYXRlIGEgY2xvbmUgb2YgdGhlIGN1cnJlbnQgb2JqZWN0IGlmIHlvdSBuZWVkIG9uZS4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5jbG9uZSgpLy8gPT4gRGF5anMKICAgICAqIGRheWpzKGRheWpzKCcyMDE5LTAxLTI1JykpIC8vIHBhc3NpbmcgYSBEYXlqcyBvYmplY3QgdG8gYSBjb25zdHJ1Y3RvciB3aWxsIGFsc28gY2xvbmUgaXQKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vcGFyc2UvZGF5anMtY2xvbmUKICAgICAqLwogICAgY2xvbmUoKTogRGF5anMKICAgIC8qKgogICAgICogVGhpcyByZXR1cm5zIGEgYGJvb2xlYW5gIGluZGljYXRpbmcgd2hldGhlciB0aGUgRGF5LmpzIG9iamVjdCBjb250YWlucyBhIHZhbGlkIGRhdGUgb3Igbm90LgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmlzVmFsaWQoKS8vID0+IGJvb2xlYW4KICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vcGFyc2UvaXMtdmFsaWQKICAgICAqLwogICAgaXNWYWxpZCgpOiBib29sZWFuCiAgICAvKioKICAgICAqIEdldCB0aGUgeWVhci4KICAgICAqIGBgYAogICAgICogZGF5anMoKS55ZWFyKCkvLyA9PiAyMDIwCiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL2dldC1zZXQveWVhcgogICAgICovCiAgICB5ZWFyKCk6IG51bWJlcgogICAgLyoqCiAgICAgKiBTZXQgdGhlIHllYXIuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkueWVhcigyMDAwKS8vID0+IERheWpzCiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL2dldC1zZXQveWVhcgogICAgICovCiAgICB5ZWFyKHZhbHVlOiBudW1iZXIpOiBEYXlqcwogICAgLyoqCiAgICAgKiBHZXQgdGhlIG1vbnRoLgogICAgICoKICAgICAqIE1vbnRocyBhcmUgemVybyBpbmRleGVkLCBzbyBKYW51YXJ5IGlzIG1vbnRoIDAuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkubW9udGgoKS8vID0+IDAtMTEKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9tb250aAogICAgICovCiAgICBtb250aCgpOiBudW1iZXIKICAgIC8qKgogICAgICogU2V0IHRoZSBtb250aC4KICAgICAqCiAgICAgKiBNb250aHMgYXJlIHplcm8gaW5kZXhlZCwgc28gSmFudWFyeSBpcyBtb250aCAwLgogICAgICoKICAgICAqIEFjY2VwdHMgbnVtYmVycyBmcm9tIDAgdG8gMTEuIElmIHRoZSByYW5nZSBpcyBleGNlZWRlZCwgaXQgd2lsbCBidWJibGUgdXAgdG8gdGhlIG5leHQgeWVhci4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5tb250aCgwKS8vID0+IERheWpzCiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL2dldC1zZXQvbW9udGgKICAgICAqLwogICAgbW9udGgodmFsdWU6IG51bWJlcik6IERheWpzCiAgICAvKioKICAgICAqIEdldCB0aGUgZGF0ZSBvZiB0aGUgbW9udGguCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkuZGF0ZSgpLy8gPT4gMS0zMQogICAgICogYGBgCiAgICAgKiBEb2NzOiBodHRwczovL2RheS5qcy5vcmcvZG9jcy9lbi9nZXQtc2V0L2RhdGUKICAgICAqLwogICAgZGF0ZSgpOiBudW1iZXIKICAgIC8qKgogICAgICogU2V0IHRoZSBkYXRlIG9mIHRoZSBtb250aC4KICAgICAqCiAgICAgKiBBY2NlcHRzIG51bWJlcnMgZnJvbSAxIHRvIDMxLiBJZiB0aGUgcmFuZ2UgaXMgZXhjZWVkZWQsIGl0IHdpbGwgYnViYmxlIHVwIHRvIHRoZSBuZXh0IG1vbnRocy4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5kYXRlKDEpLy8gPT4gRGF5anMKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9kYXRlCiAgICAgKi8KICAgIGRhdGUodmFsdWU6IG51bWJlcik6IERheWpzCiAgICAvKioKICAgICAqIEdldCB0aGUgZGF5IG9mIHRoZSB3ZWVrLgogICAgICoKICAgICAqIFJldHVybnMgbnVtYmVycyBmcm9tIDAgKFN1bmRheSkgdG8gNiAoU2F0dXJkYXkpLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmRheSgpLy8gMC02CiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL2dldC1zZXQvZGF5CiAgICAgKi8KICAgIGRheSgpOiAwIHwgMSB8IDIgfCAzIHwgNCB8IDUgfCA2CiAgICAvKioKICAgICAqIFNldCB0aGUgZGF5IG9mIHRoZSB3ZWVrLgogICAgICoKICAgICAqIEFjY2VwdHMgbnVtYmVycyBmcm9tIDAgKFN1bmRheSkgdG8gNiAoU2F0dXJkYXkpLiBJZiB0aGUgcmFuZ2UgaXMgZXhjZWVkZWQsIGl0IHdpbGwgYnViYmxlIHVwIHRvIG5leHQgd2Vla3MuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkuZGF5KDApLy8gPT4gRGF5anMKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9kYXkKICAgICAqLwogICAgZGF5KHZhbHVlOiBudW1iZXIpOiBEYXlqcwogICAgLyoqCiAgICAgKiBHZXQgdGhlIGhvdXIuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkuaG91cigpLy8gPT4gMC0yMwogICAgICogYGBgCiAgICAgKiBEb2NzOiBodHRwczovL2RheS5qcy5vcmcvZG9jcy9lbi9nZXQtc2V0L2hvdXIKICAgICAqLwogICAgaG91cigpOiBudW1iZXIKICAgIC8qKgogICAgICogU2V0IHRoZSBob3VyLgogICAgICoKICAgICAqIEFjY2VwdHMgbnVtYmVycyBmcm9tIDAgdG8gMjMuIElmIHRoZSByYW5nZSBpcyBleGNlZWRlZCwgaXQgd2lsbCBidWJibGUgdXAgdG8gdGhlIG5leHQgZGF5LgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmhvdXIoMTIpLy8gPT4gRGF5anMKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9ob3VyCiAgICAgKi8KICAgIGhvdXIodmFsdWU6IG51bWJlcik6IERheWpzCiAgICAvKioKICAgICAqIEdldCB0aGUgbWludXRlcy4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5taW51dGUoKS8vID0+IDAtNTkKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9taW51dGUKICAgICAqLwogICAgbWludXRlKCk6IG51bWJlcgogICAgLyoqCiAgICAgKiBTZXQgdGhlIG1pbnV0ZXMuCiAgICAgKgogICAgICogQWNjZXB0cyBudW1iZXJzIGZyb20gMCB0byA1OS4gSWYgdGhlIHJhbmdlIGlzIGV4Y2VlZGVkLCBpdCB3aWxsIGJ1YmJsZSB1cCB0byB0aGUgbmV4dCBob3VyLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLm1pbnV0ZSg1OSkvLyA9PiBEYXlqcwogICAgICogYGBgCiAgICAgKiBEb2NzOiBodHRwczovL2RheS5qcy5vcmcvZG9jcy9lbi9nZXQtc2V0L21pbnV0ZQogICAgICovCiAgICBtaW51dGUodmFsdWU6IG51bWJlcik6IERheWpzCiAgICAvKioKICAgICAqIEdldCB0aGUgc2Vjb25kcy4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5zZWNvbmQoKS8vID0+IDAtNTkKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9zZWNvbmQKICAgICAqLwogICAgc2Vjb25kKCk6IG51bWJlcgogICAgLyoqCiAgICAgKiBTZXQgdGhlIHNlY29uZHMuCiAgICAgKgogICAgICogQWNjZXB0cyBudW1iZXJzIGZyb20gMCB0byA1OS4gSWYgdGhlIHJhbmdlIGlzIGV4Y2VlZGVkLCBpdCB3aWxsIGJ1YmJsZSB1cCB0byB0aGUgbmV4dCBtaW51dGVzLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLnNlY29uZCgxKS8vIERheWpzCiAgICAgKiBgYGAKICAgICAqLwogICAgc2Vjb25kKHZhbHVlOiBudW1iZXIpOiBEYXlqcwogICAgLyoqCiAgICAgKiBHZXQgdGhlIG1pbGxpc2Vjb25kcy4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5taWxsaXNlY29uZCgpLy8gPT4gMC05OTkKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9taWxsaXNlY29uZAogICAgICovCiAgICBtaWxsaXNlY29uZCgpOiBudW1iZXIKICAgIC8qKgogICAgICogU2V0IHRoZSBtaWxsaXNlY29uZHMuCiAgICAgKgogICAgICogQWNjZXB0cyBudW1iZXJzIGZyb20gMCB0byA5OTkuIElmIHRoZSByYW5nZSBpcyBleGNlZWRlZCwgaXQgd2lsbCBidWJibGUgdXAgdG8gdGhlIG5leHQgc2Vjb25kcy4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5taWxsaXNlY29uZCgxKS8vID0+IERheWpzCiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL2dldC1zZXQvbWlsbGlzZWNvbmQKICAgICAqLwogICAgbWlsbGlzZWNvbmQodmFsdWU6IG51bWJlcik6IERheWpzCiAgICAvKioKICAgICAqIEdlbmVyaWMgc2V0dGVyLCBhY2NlcHRpbmcgdW5pdCBhcyBmaXJzdCBhcmd1bWVudCwgYW5kIHZhbHVlIGFzIHNlY29uZCwgcmV0dXJucyBhIG5ldyBpbnN0YW5jZSB3aXRoIHRoZSBhcHBsaWVkIGNoYW5nZXMuCiAgICAgKgogICAgICogSW4gZ2VuZXJhbDoKICAgICAqIGBgYAogICAgICogZGF5anMoKS5zZXQodW5pdCwgdmFsdWUpID09PSBkYXlqcygpW3VuaXRdKHZhbHVlKQogICAgICogYGBgCiAgICAgKiBVbml0cyBhcmUgY2FzZSBpbnNlbnNpdGl2ZSwgYW5kIHN1cHBvcnQgcGx1cmFsIGFuZCBzaG9ydCBmb3Jtcy4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5zZXQoJ2RhdGUnLCAxKQogICAgICogZGF5anMoKS5zZXQoJ21vbnRoJywgMykgLy8gQXByaWwKICAgICAqIGRheWpzKCkuc2V0KCdzZWNvbmQnLCAzMCkKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZ2V0LXNldC9zZXQKICAgICAqLwogICAgc2V0KHVuaXQ6IFVuaXRUeXBlLCB2YWx1ZTogbnVtYmVyKTogRGF5anMKICAgIC8qKgogICAgICogU3RyaW5nIGdldHRlciwgcmV0dXJucyB0aGUgY29ycmVzcG9uZGluZyBpbmZvcm1hdGlvbiBnZXR0aW5nIGZyb20gRGF5LmpzIG9iamVjdC4KICAgICAqCiAgICAgKiBJbiBnZW5lcmFsOgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmdldCh1bml0KSA9PT0gZGF5anMoKVt1bml0XSgpCiAgICAgKiBgYGAKICAgICAqIFVuaXRzIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgc3VwcG9ydCBwbHVyYWwgYW5kIHNob3J0IGZvcm1zLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmdldCgneWVhcicpCiAgICAgKiBkYXlqcygpLmdldCgnbW9udGgnKSAvLyBzdGFydCAwCiAgICAgKiBkYXlqcygpLmdldCgnZGF0ZScpCiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL2dldC1zZXQvZ2V0CiAgICAgKi8KICAgIGdldCh1bml0OiBVbml0VHlwZSk6IG51bWJlcgogICAgLyoqCiAgICAgKiBSZXR1cm5zIGEgY2xvbmVkIERheS5qcyBvYmplY3Qgd2l0aCBhIHNwZWNpZmllZCBhbW91bnQgb2YgdGltZSBhZGRlZC4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5hZGQoNywgJ2RheScpLy8gPT4gRGF5anMKICAgICAqIGBgYAogICAgICogVW5pdHMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBzdXBwb3J0IHBsdXJhbCBhbmQgc2hvcnQgZm9ybXMuCiAgICAgKgogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vbWFuaXB1bGF0ZS9hZGQKICAgICAqLwogICAgYWRkKHZhbHVlOiBudW1iZXIsIHVuaXQ/OiBNYW5pcHVsYXRlVHlwZSk6IERheWpzCiAgICAvKioKICAgICAqIFJldHVybnMgYSBjbG9uZWQgRGF5LmpzIG9iamVjdCB3aXRoIGEgc3BlY2lmaWVkIGFtb3VudCBvZiB0aW1lIHN1YnRyYWN0ZWQuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkuc3VidHJhY3QoNywgJ3llYXInKS8vID0+IERheWpzCiAgICAgKiBgYGAKICAgICAqIFVuaXRzIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgc3VwcG9ydCBwbHVyYWwgYW5kIHNob3J0IGZvcm1zLgogICAgICoKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL21hbmlwdWxhdGUvc3VidHJhY3QKICAgICAqLwogICAgc3VidHJhY3QodmFsdWU6IG51bWJlciwgdW5pdD86IE1hbmlwdWxhdGVUeXBlKTogRGF5anMKICAgIC8qKgogICAgICogUmV0dXJucyBhIGNsb25lZCBEYXkuanMgb2JqZWN0IGFuZCBzZXQgaXQgdG8gdGhlIHN0YXJ0IG9mIGEgdW5pdCBvZiB0aW1lLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLnN0YXJ0T2YoJ3llYXInKS8vID0+IERheWpzCiAgICAgKiBgYGAKICAgICAqIFVuaXRzIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgc3VwcG9ydCBwbHVyYWwgYW5kIHNob3J0IGZvcm1zLgogICAgICoKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL21hbmlwdWxhdGUvc3RhcnQtb2YKICAgICAqLwogICAgc3RhcnRPZih1bml0OiBPcFVuaXRUeXBlKTogRGF5anMKICAgIC8qKgogICAgICogUmV0dXJucyBhIGNsb25lZCBEYXkuanMgb2JqZWN0IGFuZCBzZXQgaXQgdG8gdGhlIGVuZCBvZiBhIHVuaXQgb2YgdGltZS4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5lbmRPZignbW9udGgnKS8vID0+IERheWpzCiAgICAgKiBgYGAKICAgICAqIFVuaXRzIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBhbmQgc3VwcG9ydCBwbHVyYWwgYW5kIHNob3J0IGZvcm1zLgogICAgICoKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL21hbmlwdWxhdGUvZW5kLW9mCiAgICAgKi8KICAgIGVuZE9mKHVuaXQ6IE9wVW5pdFR5cGUpOiBEYXlqcwogICAgLyoqCiAgICAgKiBHZXQgdGhlIGZvcm1hdHRlZCBkYXRlIGFjY29yZGluZyB0byB0aGUgc3RyaW5nIG9mIHRva2VucyBwYXNzZWQgaW4uCiAgICAgKgogICAgICogVG8gZXNjYXBlIGNoYXJhY3RlcnMsIHdyYXAgdGhlbSBpbiBzcXVhcmUgYnJhY2tldHMgKGUuZy4gW01NXSkuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkuZm9ybWF0KCkvLyA9PiBjdXJyZW50IGRhdGUgaW4gSVNPODYwMSwgd2l0aG91dCBmcmFjdGlvbiBzZWNvbmRzIGUuZy4gJzIwMjAtMDQtMDJUMDg6MDI6MTctMDU6MDAnCiAgICAgKiBkYXlqcygnMjAxOS0wMS0yNScpLmZvcm1hdCgnW1lZWVllc2NhcGVdIFlZWVktTU0tRERUSEg6bW06c3NaW1pdJykvLyAnWVlZWWVzY2FwZSAyMDE5LTAxLTI1VDAwOjAwOjAwLTAyOjAwWicKICAgICAqIGRheWpzKCcyMDE5LTAxLTI1JykuZm9ybWF0KCdERC9NTS9ZWVlZJykgLy8gJzI1LzAxLzIwMTknCiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL2Rpc3BsYXkvZm9ybWF0CiAgICAgKi8KICAgIGZvcm1hdCh0ZW1wbGF0ZT86IHN0cmluZyk6IHN0cmluZwogICAgLyoqCiAgICAgKiBUaGlzIGluZGljYXRlcyB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHR3byBkYXRlLXRpbWUgaW4gdGhlIHNwZWNpZmllZCB1bml0LgogICAgICoKICAgICAqIFRvIGdldCB0aGUgZGlmZmVyZW5jZSBpbiBtaWxsaXNlY29uZHMsIHVzZSBgZGF5anMjZGlmZmAKICAgICAqIGBgYAogICAgICogY29uc3QgZGF0ZTEgPSBkYXlqcygnMjAxOS0wMS0yNScpCiAgICAgKiBjb25zdCBkYXRlMiA9IGRheWpzKCcyMDE4LTA2LTA1JykKICAgICAqIGRhdGUxLmRpZmYoZGF0ZTIpIC8vIDIwMjE0MDAwMDAwIGRlZmF1bHQgbWlsbGlzZWNvbmRzCiAgICAgKiBkYXRlMS5kaWZmKCkgLy8gbWlsbGlzZWNvbmRzIHRvIGN1cnJlbnQgdGltZQogICAgICogYGBgCiAgICAgKgogICAgICogVG8gZ2V0IHRoZSBkaWZmZXJlbmNlIGluIGFub3RoZXIgdW5pdCBvZiBtZWFzdXJlbWVudCwgcGFzcyB0aGF0IG1lYXN1cmVtZW50IGFzIHRoZSBzZWNvbmQgYXJndW1lbnQuCiAgICAgKiBgYGAKICAgICAqIGNvbnN0IGRhdGUxID0gZGF5anMoJzIwMTktMDEtMjUnKQogICAgICogZGF0ZTEuZGlmZignMjAxOC0wNi0wNScsICdtb250aCcpIC8vIDcKICAgICAqIGBgYAogICAgICogVW5pdHMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBzdXBwb3J0IHBsdXJhbCBhbmQgc2hvcnQgZm9ybXMuCiAgICAgKgogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZGlzcGxheS9kaWZmZXJlbmNlCiAgICAgKi8KICAgIGRpZmYoZGF0ZT86IENvbmZpZ1R5cGUsIHVuaXQ/OiBRVW5pdFR5cGUgfCBPcFVuaXRUeXBlLCBmbG9hdD86IGJvb2xlYW4pOiBudW1iZXIKICAgIC8qKgogICAgICogVGhpcyByZXR1cm5zIHRoZSBudW1iZXIgb2YgKiptaWxsaXNlY29uZHMqKiBzaW5jZSB0aGUgVW5peCBFcG9jaCBvZiB0aGUgRGF5LmpzIG9iamVjdC4KICAgICAqIGBgYAogICAgICogZGF5anMoJzIwMTktMDEtMjUnKS52YWx1ZU9mKCkgLy8gMTU0ODM4MTYwMDAwMAogICAgICogK2RheWpzKDE1NDgzODE2MDAwMDApIC8vIDE1NDgzODE2MDAwMDAKICAgICAqIGBgYAogICAgICogVG8gZ2V0IGEgVW5peCB0aW1lc3RhbXAgKHRoZSBudW1iZXIgb2Ygc2Vjb25kcyBzaW5jZSB0aGUgZXBvY2gpIGZyb20gYSBEYXkuanMgb2JqZWN0LCB5b3Ugc2hvdWxkIHVzZSBVbml4IFRpbWVzdGFtcCBgZGF5anMjdW5peCgpYC4KICAgICAqCiAgICAgKiBEb2NzOiBodHRwczovL2RheS5qcy5vcmcvZG9jcy9lbi9kaXNwbGF5L3VuaXgtdGltZXN0YW1wLW1pbGxpc2Vjb25kcwogICAgICovCiAgICB2YWx1ZU9mKCk6IG51bWJlcgogICAgLyoqCiAgICAgKiBUaGlzIHJldHVybnMgdGhlIFVuaXggdGltZXN0YW1wICh0aGUgbnVtYmVyIG9mICoqc2Vjb25kcyoqIHNpbmNlIHRoZSBVbml4IEVwb2NoKSBvZiB0aGUgRGF5LmpzIG9iamVjdC4KICAgICAqIGBgYAogICAgICogZGF5anMoJzIwMTktMDEtMjUnKS51bml4KCkgLy8gMTU0ODM4MTYwMAogICAgICogYGBgCiAgICAgKiBUaGlzIHZhbHVlIGlzIGZsb29yZWQgdG8gdGhlIG5lYXJlc3Qgc2Vjb25kLCBhbmQgZG9lcyBub3QgaW5jbHVkZSBhIG1pbGxpc2Vjb25kcyBjb21wb25lbnQuCiAgICAgKgogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZGlzcGxheS91bml4LXRpbWVzdGFtcAogICAgICovCiAgICB1bml4KCk6IG51bWJlcgogICAgLyoqCiAgICAgKiBHZXQgdGhlIG51bWJlciBvZiBkYXlzIGluIHRoZSBjdXJyZW50IG1vbnRoLgogICAgICogYGBgCiAgICAgKiBkYXlqcygnMjAxOS0wMS0yNScpLmRheXNJbk1vbnRoKCkgLy8gMzEKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZGlzcGxheS9kYXlzLWluLW1vbnRoCiAgICAgKi8KICAgIGRheXNJbk1vbnRoKCk6IG51bWJlcgogICAgLyoqCiAgICAgKiBUbyBnZXQgYSBjb3B5IG9mIHRoZSBuYXRpdmUgYERhdGVgIG9iamVjdCBwYXJzZWQgZnJvbSB0aGUgRGF5LmpzIG9iamVjdCB1c2UgYGRheWpzI3RvRGF0ZWAuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCcyMDE5LTAxLTI1JykudG9EYXRlKCkvLyA9PiBEYXRlCiAgICAgKiBgYGAKICAgICAqLwogICAgdG9EYXRlKCk6IERhdGUKICAgIC8qKgogICAgICogVG8gc2VyaWFsaXplIGFzIGFuIElTTyA4NjAxIHN0cmluZy4KICAgICAqIGBgYAogICAgICogZGF5anMoJzIwMTktMDEtMjUnKS50b0pTT04oKSAvLyAnMjAxOS0wMS0yNVQwMjowMDowMC4wMDBaJwogICAgICogYGBgCiAgICAgKiBEb2NzOiBodHRwczovL2RheS5qcy5vcmcvZG9jcy9lbi9kaXNwbGF5L2FzLWpzb24KICAgICAqLwogICAgdG9KU09OKCk6IHN0cmluZwogICAgLyoqCiAgICAgKiBUbyBmb3JtYXQgYXMgYW4gSVNPIDg2MDEgc3RyaW5nLgogICAgICogYGBgCiAgICAgKiBkYXlqcygnMjAxOS0wMS0yNScpLnRvSVNPU3RyaW5nKCkgLy8gJzIwMTktMDEtMjVUMDI6MDA6MDAuMDAwWicKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vZGlzcGxheS9hcy1pc28tc3RyaW5nCiAgICAgKi8KICAgIHRvSVNPU3RyaW5nKCk6IHN0cmluZwogICAgLyoqCiAgICAgKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBkYXRlLgogICAgICogYGBgCiAgICAgKiBkYXlqcygnMjAxOS0wMS0yNScpLnRvU3RyaW5nKCkgLy8gJ0ZyaSwgMjUgSmFuIDIwMTkgMDI6MDA6MDAgR01UJwogICAgICogYGBgCiAgICAgKiBEb2NzOiBodHRwczovL2RheS5qcy5vcmcvZG9jcy9lbi9kaXNwbGF5L2FzLXN0cmluZwogICAgICovCiAgICB0b1N0cmluZygpOiBzdHJpbmcKICAgIC8qKgogICAgICogR2V0IHRoZSBVVEMgb2Zmc2V0IGluIG1pbnV0ZXMuCiAgICAgKiBgYGAKICAgICAqIGRheWpzKCkudXRjT2Zmc2V0KCkKICAgICAqIGBgYAogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vbWFuaXB1bGF0ZS91dGMtb2Zmc2V0CiAgICAgKi8KICAgIHV0Y09mZnNldCgpOiBudW1iZXIKICAgIC8qKgogICAgICogVGhpcyBpbmRpY2F0ZXMgd2hldGhlciB0aGUgRGF5LmpzIG9iamVjdCBpcyBiZWZvcmUgdGhlIG90aGVyIHN1cHBsaWVkIGRhdGUtdGltZS4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5pc0JlZm9yZShkYXlqcygnMjAxMS0wMS0wMScpKSAvLyBkZWZhdWx0IG1pbGxpc2Vjb25kcwogICAgICogYGBgCiAgICAgKiBJZiB5b3Ugd2FudCB0byBsaW1pdCB0aGUgZ3JhbnVsYXJpdHkgdG8gYSB1bml0IG90aGVyIHRoYW4gbWlsbGlzZWNvbmRzLCBwYXNzIGl0IGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmlzQmVmb3JlKCcyMDExLTAxLTAxJywgJ3llYXInKS8vID0+IGJvb2xlYW4KICAgICAqIGBgYAogICAgICogVW5pdHMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBzdXBwb3J0IHBsdXJhbCBhbmQgc2hvcnQgZm9ybXMuCiAgICAgKgogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vcXVlcnkvaXMtYmVmb3JlCiAgICAgKi8KICAgIGlzQmVmb3JlKGRhdGU/OiBDb25maWdUeXBlLCB1bml0PzogT3BVbml0VHlwZSk6IGJvb2xlYW4KICAgIC8qKgogICAgICogVGhpcyBpbmRpY2F0ZXMgd2hldGhlciB0aGUgRGF5LmpzIG9iamVjdCBpcyB0aGUgc2FtZSBhcyB0aGUgb3RoZXIgc3VwcGxpZWQgZGF0ZS10aW1lLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmlzU2FtZShkYXlqcygnMjAxMS0wMS0wMScpKSAvLyBkZWZhdWx0IG1pbGxpc2Vjb25kcwogICAgICogYGBgCiAgICAgKiBJZiB5b3Ugd2FudCB0byBsaW1pdCB0aGUgZ3JhbnVsYXJpdHkgdG8gYSB1bml0IG90aGVyIHRoYW4gbWlsbGlzZWNvbmRzLCBwYXNzIGl0IGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmlzU2FtZSgnMjAxMS0wMS0wMScsICd5ZWFyJykvLyA9PiBib29sZWFuCiAgICAgKiBgYGAKICAgICAqIERvY3M6IGh0dHBzOi8vZGF5LmpzLm9yZy9kb2NzL2VuL3F1ZXJ5L2lzLXNhbWUKICAgICAqLwogICAgaXNTYW1lKGRhdGU/OiBDb25maWdUeXBlLCB1bml0PzogT3BVbml0VHlwZSk6IGJvb2xlYW4KICAgIC8qKgogICAgICogVGhpcyBpbmRpY2F0ZXMgd2hldGhlciB0aGUgRGF5LmpzIG9iamVjdCBpcyBhZnRlciB0aGUgb3RoZXIgc3VwcGxpZWQgZGF0ZS10aW1lLgogICAgICogYGBgCiAgICAgKiBkYXlqcygpLmlzQWZ0ZXIoZGF5anMoJzIwMTEtMDEtMDEnKSkgLy8gZGVmYXVsdCBtaWxsaXNlY29uZHMKICAgICAqIGBgYAogICAgICogSWYgeW91IHdhbnQgdG8gbGltaXQgdGhlIGdyYW51bGFyaXR5IHRvIGEgdW5pdCBvdGhlciB0aGFuIG1pbGxpc2Vjb25kcywgcGFzcyBpdCBhcyB0aGUgc2Vjb25kIHBhcmFtZXRlci4KICAgICAqIGBgYAogICAgICogZGF5anMoKS5pc0FmdGVyKCcyMDExLTAxLTAxJywgJ3llYXInKS8vID0+IGJvb2xlYW4KICAgICAqIGBgYAogICAgICogVW5pdHMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIGFuZCBzdXBwb3J0IHBsdXJhbCBhbmQgc2hvcnQgZm9ybXMuCiAgICAgKgogICAgICogRG9jczogaHR0cHM6Ly9kYXkuanMub3JnL2RvY3MvZW4vcXVlcnkvaXMtYWZ0ZXIKICAgICAqLwogICAgaXNBZnRlcihkYXRlPzogQ29uZmlnVHlwZSwgdW5pdD86IE9wVW5pdFR5cGUpOiBib29sZWFuCgogICAgbG9jYWxlKCk6IHN0cmluZwoKICAgIGxvY2FsZShwcmVzZXQ6IHN0cmluZyB8IElMb2NhbGUsIG9iamVjdD86IFBhcnRpYWw8SUxvY2FsZT4pOiBEYXlqcwogIH0KCiAgZXhwb3J0IHR5cGUgUGx1Z2luRnVuYzxUID0gdW5rbm93bj4gPSAob3B0aW9uOiBULCBjOiB0eXBlb2YgRGF5anMsIGQ6IHR5cGVvZiBkYXlqcykgPT4gdm9pZAoKICBleHBvcnQgZnVuY3Rpb24gZXh0ZW5kPFQgPSB1bmtub3duPihwbHVnaW46IFBsdWdpbkZ1bmM8VD4sIG9wdGlvbj86IFQpOiBEYXlqcwoKICBleHBvcnQgZnVuY3Rpb24gbG9jYWxlKHByZXNldD86IHN0cmluZyB8IElMb2NhbGUsIG9iamVjdD86IFBhcnRpYWw8SUxvY2FsZT4sIGlzTG9jYWw/OiBib29sZWFuKTogc3RyaW5nCgogIGV4cG9ydCBmdW5jdGlvbiBpc0RheWpzKGQ6IGFueSk6IGQgaXMgRGF5anMKCiAgZXhwb3J0IGZ1bmN0aW9uIHVuaXgodDogbnVtYmVyKTogRGF5anMKCiAgY29uc3QgTHMgOiB7IFtrZXk6IHN0cmluZ10gOiAgSUxvY2FsZSB9Cn0K";
const JSONPATH_BASE64 = "dHlwZSBQYXRoQ29tcG9uZW50ID0gc3RyaW5nIHwgbnVtYmVyOwoKLyoqCiAqIEZpbmQgZWxlbWVudHMgaW4gYG9iamAgbWF0Y2hpbmcgYHBhdGhFeHByZXNzaW9uYC4gUmV0dXJucyBhbiBhcnJheSBvZiBlbGVtZW50cyB0aGF0CiAqIHNhdGlzZnkgdGhlIHByb3ZpZGVkIEpTT05QYXRoIGV4cHJlc3Npb24sb3IgYW4gZW1wdHkgYXJyYXkgaWYgbm9uZSB3ZXJlIG1hdGNoZWQuCiAqIFJldHVybnMgb25seSBmaXJzdCBgY291bnRgIGVsZW1lbnRzIGlmIHNwZWNpZmllZC4KICovCmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHF1ZXJ5KG9iajogYW55LCBwYXRoRXhwcmVzc2lvbjogc3RyaW5nLCBjb3VudD86IG51bWJlcik6IGFueVtdOwoKLyoqCiAqIEZpbmQgcGF0aHMgdG8gZWxlbWVudHMgaW4gYG9iamAgbWF0Y2hpbmcgYHBhdGhFeHByZXNzaW9uYC4gUmV0dXJucyBhbiBhcnJheSBvZgogKiBlbGVtZW50IHBhdGhzIHRoYXQgc2F0aXNmeSB0aGUgcHJvdmlkZWQgSlNPTlBhdGggZXhwcmVzc2lvbi4gRWFjaCBwYXRoIGlzIGl0c2VsZiBhbgogKiBhcnJheSBvZiBrZXlzIHJlcHJlc2VudGluZyB0aGUgbG9jYXRpb24gd2l0aGluIGBvYmpgIG9mIHRoZSBtYXRjaGluZyBlbGVtZW50LiBSZXR1cm5zCiAqIG9ubHkgZmlyc3QgYGNvdW50YCBwYXRocyBpZiBzcGVjaWZpZWQuCiAqLwpleHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBwYXRocyhvYmo6IGFueSwgcGF0aEV4cHJlc3Npb246IHN0cmluZywgY291bnQ/OiBudW1iZXIpOiBQYXRoQ29tcG9uZW50W11bXTsKCi8qKgogKiBGaW5kIGVsZW1lbnRzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIHBhdGhzIGluIGBvYmpgIG1hdGNoaW5nIGBwYXRoRXhwcmVzc2lvbmAuCiAqIFJldHVybnMgYW4gYXJyYXkgb2Ygbm9kZSBvYmplY3RzIHdoZXJlIGVhY2ggbm9kZSBoYXMgYSBgcGF0aGAgY29udGFpbmluZyBhbiBhcnJheSBvZgogKiBrZXlzIHJlcHJlc2VudGluZyB0aGUgbG9jYXRpb24gd2l0aGluIGBvYmpgLCBhbmQgYSBgdmFsdWVgIHBvaW50aW5nIHRvIHRoZSBtYXRjaGVkCiAqIGVsZW1lbnQuIFJldHVybnMgb25seSBmaXJzdCBgY291bnRgIG5vZGVzIGlmIHNwZWNpZmllZC4KICovCmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIG5vZGVzKAogICAgb2JqOiBhbnksCiAgICBwYXRoRXhwcmVzc2lvbjogc3RyaW5nLAogICAgY291bnQ/OiBudW1iZXIsCik6IEFycmF5PHsgcGF0aDogUGF0aENvbXBvbmVudFtdOyB2YWx1ZTogYW55IH0+OwoKLyoqCiAqIFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBlbGVtZW50IG1hdGNoaW5nIGBwYXRoRXhwcmVzc2lvbmAuIElmIGBuZXdWYWx1ZWAgaXMKICogcHJvdmlkZWQsIHNldHMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBtYXRjaGluZyBlbGVtZW50IGFuZCByZXR1cm5zIHRoZSBuZXcgdmFsdWUuCiAqLwpleHBvcnQgZGVjbGFyZSBmdW5jdGlvbiB2YWx1ZShvYmo6IGFueSwgcGF0aEV4cHJlc3Npb246IHN0cmluZyk6IGFueTsKZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gdmFsdWU8VD4ob2JqOiBhbnksIHBhdGhFeHByZXNzaW9uOiBzdHJpbmcsIG5ld1ZhbHVlOiBUKTogVDsKCi8qKgogKiBSZXR1cm5zIHRoZSBwYXJlbnQgb2YgdGhlIGZpcnN0IG1hdGNoaW5nIGVsZW1lbnQuCiAqLwpleHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBwYXJlbnQob2JqOiBhbnksIHBhdGhFeHByZXNzaW9uOiBzdHJpbmcpOiBhbnk7CgovKioKICogUnVucyB0aGUgc3VwcGxpZWQgZnVuY3Rpb24gYGZuYCBvbiBlYWNoIG1hdGNoaW5nIGVsZW1lbnQsIGFuZCByZXBsYWNlcyBlYWNoCiAqIG1hdGNoaW5nIGVsZW1lbnQgd2l0aCB0aGUgcmV0dXJuIHZhbHVlIGZyb20gdGhlIGZ1bmN0aW9uLiBUaGUgZnVuY3Rpb24gYWNjZXB0cyB0aGUKICogdmFsdWUgb2YgdGhlIG1hdGNoaW5nIGVsZW1lbnQgYXMgaXRzIG9ubHkgcGFyYW1ldGVyLiBSZXR1cm5zIG1hdGNoaW5nIG5vZGVzIHdpdGgKICogdGhlaXIgdXBkYXRlZCB2YWx1ZXMuCiAqLwpleHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBhcHBseSgKICAgIG9iajogYW55LAogICAgcGF0aEV4cHJlc3Npb246IHN0cmluZywKICAgIGZuOiAoeDogYW55KSA9PiBhbnksCik6IEFycmF5PHsgcGF0aDogUGF0aENvbXBvbmVudFtdOyB2YWx1ZTogYW55IH0+OwoKLyoqCiAqIFBhcnNlIHRoZSBwcm92aWRlZCBKU09OUGF0aCBleHByZXNzaW9uIGludG8gcGF0aCBjb21wb25lbnRzIGFuZCB0aGVpciBhc3NvY2lhdGVkCiAqIG9wZXJhdGlvbnMuCiAqLwpleHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBwYXJzZShwYXRoRXhwcmVzc2lvbjogc3RyaW5nKTogYW55W107CgovKioKICogUmV0dXJucyBhIHBhdGggZXhwcmVzc2lvbiBpbiBzdHJpbmcgZm9ybSwgZ2l2ZW4gYSBwYXRoLiBUaGUgc3VwcGxpZWQgcGF0aCBtYXkgZWl0aGVyCiAqIGJlIGEgZmxhdCBhcnJheSBvZiBrZXlzLCBhcyByZXR1cm5lZCBieSBganAubm9kZXNgIGZvciBleGFtcGxlLCBvciBtYXkgYWx0ZXJuYXRpdmVseSBiZSBhCiAqIGZ1bGx5IHBhcnNlZCBwYXRoIGV4cHJlc3Npb24gaW4gdGhlIGZvcm0gb2YgYW4gYXJyYXkgb2YgcGF0aCBjb21wb25lbnRzIGFzIHJldHVybmVkCiAqIGJ5IGBqcC5wYXJzZWAuCiAqLwpleHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBzdHJpbmdpZnkocGF0aDogUGF0aENvbXBvbmVudFtdKTogc3RyaW5nOwoKZXhwb3J0IGFzIG5hbWVzcGFjZSBqc29ucGF0aDsK";
const SMART_LEGAL_CONTRACT_BASE64 = "LyoKICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlICJMaWNlbnNlIik7CiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4KICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0CiAqCiAqIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMAogKgogKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlCiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuICJBUyBJUyIgQkFTSVMsCiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLgogKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kCiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLgogKi8KCi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1lbXB0eS1vYmplY3QtdHlwZSAqLwoKLy8gd2UgZHVwbGljYXRlIHRoZXNlIGludGVyZmFjZXMgaGVyZSB0byBhdm9pZCBpbXBvcnRzIGludG8gdGhlIHJ1bnRpbWUKaW50ZXJmYWNlIElDb25jZXB0IHsKICAgICRjbGFzczogc3RyaW5nOwogfQoKaW50ZXJmYWNlIElUcmFuc2FjdGlvbiBleHRlbmRzIElDb25jZXB0IHsKICAgICR0aW1lc3RhbXA6IERhdGU7CiB9CgppbnRlcmZhY2UgSUV2ZW50IGV4dGVuZHMgSUNvbmNlcHQgewogICAkdGltZXN0YW1wOiBEYXRlOwp9CgppbnRlcmZhY2UgSVN0YXRlIHsKICAgICRpZGVudGlmaWVyOiBzdHJpbmc7Cn0KCmludGVyZmFjZSBFbmdpbmVSZXNwb25zZTxTIGV4dGVuZHMgSVN0YXRlPiB7CiAgICBzdGF0ZT86IFM7CiAgICBldmVudHM/OiBBcnJheTxJRXZlbnQ+Cn0KCmludGVyZmFjZSBJUmVxdWVzdCBleHRlbmRzIElUcmFuc2FjdGlvbiB7Cn0KCmludGVyZmFjZSBJUmVzcG9uc2UgZXh0ZW5kcyBJVHJhbnNhY3Rpb24gewp9CgppbnRlcmZhY2UgSUFzc2V0IGV4dGVuZHMgSUNvbmNlcHQgewogICAkaWRlbnRpZmllcjogc3RyaW5nOwp9CgppbnRlcmZhY2UgSUNvbnRyYWN0IGV4dGVuZHMgSUFzc2V0IHsKICAgY29udHJhY3RJZDogc3RyaW5nOwp9CgppbnRlcmZhY2UgSUNsYXVzZSBleHRlbmRzIElBc3NldCB7CiAgIGNsYXVzZUlkOiBzdHJpbmc7Cn0KCmludGVyZmFjZSBUcmlnZ2VyUmVzcG9uc2U8UyBleHRlbmRzIElTdGF0ZSA9IElTdGF0ZT4gZXh0ZW5kcyBFbmdpbmVSZXNwb25zZTxTPiB7CiAgICByZXN1bHQ6IElSZXNwb25zZTsKfQoKaW50ZXJmYWNlIEluaXRSZXNwb25zZTxTIGV4dGVuZHMgSVN0YXRlPiBleHRlbmRzIEVuZ2luZVJlc3BvbnNlPFM+IHt9Cgp0eXBlIFRlbXBsYXRlRGF0YSA9IElDb250cmFjdHxJQ2xhdXNlOwoKZXhwb3J0IGFic3RyYWN0IGNsYXNzIFRlbXBsYXRlTG9naWM8VCBleHRlbmRzIFRlbXBsYXRlRGF0YSwgUyBleHRlbmRzIElTdGF0ZSA9IElTdGF0ZT4gewogICAgYWJzdHJhY3QgdHJpZ2dlcihkYXRhOiBULCByZXF1ZXN0OiBJUmVxdWVzdCwgc3RhdGU6UykgOiBQcm9taXNlPFRyaWdnZXJSZXNwb25zZTxTPj47CiAgICBpbml0KGRhdGE6IFQpIDogUHJvbWlzZTxJbml0UmVzcG9uc2U8Uz58dW5kZWZpbmVkPjsKfQo=";

const TYPESCRIPT_URL = process.env.TYPESCRIPT_URL ? process.env.TYPESCRIPT_URL : "https://cdn.jsdelivr.net/npm/typescript@4.9.4/+esm";
const SCRIPT_TARGET = 9;
const MODULE_KIND = 6;
class TypeScriptToJavaScriptCompiler {
  constructor(modelManager, templateConceptFqn) {
    this.context = new TypeScriptCompilationContext(modelManager, templateConceptFqn).getCompilationContext();
    this.typescriptUrl = TYPESCRIPT_URL;
  }
  async initialize(typescriptUrl) {
    if (typescriptUrl) {
      this.typescriptUrl = typescriptUrl;
    }
    if (typeof window === "undefined") {
      this.ts = (await import('typescript')).default;
      if (!this.ts) {
        throw new Error("Failed to load typescript module");
      }
      this.fsMap = vfs.createDefaultMapFromNodeModules({
        target: SCRIPT_TARGET
      });
    } else {
      this.ts = (await import(this.typescriptUrl)).default;
      if (!this.ts) {
        throw new Error("Failed to dynamically load typescript");
      }
      this.fsMap = await vfs.createDefaultMapFromCDN({ target: SCRIPT_TARGET }, this.ts.version, false, this.ts);
    }
    this.fsMap.set("/node_modules/@types/dayjs/index.d.ts", Buffer.from(DAYJS_BASE64, "base64").toString());
    this.fsMap.set("/node_modules/@types/jsonpath/index.d.ts", Buffer.from(JSONPATH_BASE64, "base64").toString());
  }
  compile(typescript) {
    if (!this.fsMap) {
      throw new Error("initialize must be awaited before compile is called.");
    }
    const twoSlashCode = `
${this.context}
${typescript}
`;
    const options = {
      fsMap: this.fsMap,
      tsModule: this.ts,
      defaultCompilerOptions: {
        target: SCRIPT_TARGET,
        module: MODULE_KIND
      },
      lzstringModule: lzstring__namespace,
      defaultOptions: {
        showEmit: true,
        noErrorValidation: true,
        showEmittedFile: "code.js"
      }
    };
    const result = twoslash.twoslasher(twoSlashCode, "ts", options);
    return result;
  }
}

var CodeType = /* @__PURE__ */ ((CodeType2) => {
  CodeType2["TYPESCRIPT"] = "TYPESCRIPT";
  CodeType2["ES_2020"] = "ES_2020";
  return CodeType2;
})(CodeType || {});

const CODE_NODES = [
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.FormulaDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.ConditionalDefinition`,
  `${markdownCommon.TemplateMarkModel.NAMESPACE}.ClauseDefinition`
];
function checkCode$1(code) {
  if (code.type !== CodeType.TYPESCRIPT) {
    throw new Error(`Cannot compile ${code.contents} as it is not Typescript.`);
  }
}
class TemplateMarkToJavaScriptCompiler {
  constructor(modelManager, templateConceptFqn) {
    this.modelManager = modelManager;
    this.compiler = new TypeScriptToJavaScriptCompiler(modelManager, templateConceptFqn);
    this.templateClass = getTemplateClassDeclaration(modelManager, templateConceptFqn);
  }
  async initialize() {
    await this.compiler.initialize();
  }
  compile(templateJson) {
    const namedTemplateMark = nameUserCode(templateJson);
    const that = this;
    const errors = Array();
    const compiled = traverse(namedTemplateMark).map(function(x) {
      if (x && CODE_NODES.includes(x.$class)) {
        if (x.code) {
          checkCode$1(x.code);
          const result = that.compiler.compile(writeFunctionToString(that.templateClass, x.name, "any", x.code.contents));
          if (result.errors.length === 0) {
            x.code.contents = result.code;
            x.code.type = CodeType.ES_2020;
            this.update(x);
          } else {
            errors.push({
              nodeId: x.name,
              code: x.code.contents,
              errors: result.errors
            });
          }
        } else if (x.condition) {
          checkCode$1(x.condition);
          const result = that.compiler.compile(writeFunctionToString(that.templateClass, x.functionName, "boolean", x.condition.contents));
          if (result.errors.length === 0) {
            x.condition.contents = result.code;
            x.condition.type = CodeType.ES_2020;
            this.update(x);
          } else {
            errors.push({
              nodeId: x.functionName,
              code: x.condition.contents,
              errors: result.errors
            });
          }
        }
      }
    });
    if (errors.length === 0) {
      return compiled;
    } else {
      throw errors;
    }
  }
}

function joinList(data, joinDef, options) {
  if (joinDef.separator) {
    return data.join(joinDef.separator);
  } else {
    const formatter = new Intl.ListFormat(
      joinDef.locale ? joinDef.locale : options?.locale,
      {
        style: joinDef.style,
        type: joinDef.type
      }
    );
    return formatter.format(data);
  }
}

async function sleep(msec) {
  return new Promise((resolve) => setTimeout(resolve, msec));
}
const _import = async (path2) => new Function("specifier", "return import(specifier)")(path2);
const dynamicImport = async (path2, symbol) => {
  const mod = await _import(path2);
  return symbol ? mod.symbol : mod.default;
};
class JavaScriptEvaluator {
  // queue of work to do
  constructor(options = { waitInterval: 50, maxWorkers: 8, maxQueueDepth: 1e3 }) {
    this.options = options;
    this.workers = [];
    this.queue = [];
  }
  /**
   * Evaluates a JS function in process.
   * @param {EvalRequest} request - the eval request
   * @returns {Promise} a promise to the result
   */
  async evalDangerously(request) {
    return new Promise((resolve, reject) => {
      try {
        if (request.verbose) {
          console.log(request.code);
        }
        const start = (/* @__PURE__ */ new Date()).getTime();
        let result = null;
        if (!request.templateLogic) {
          const fun = new Function(...["dayjs", "jp", ...request.argumentNames], request.code);
          result = fun(...[dayjs, jp, ...request.arguments]);
          const end = (/* @__PURE__ */ new Date()).getTime();
          resolve({ result, elapsed: end - start });
        } else {
          const dataUri = "data:text/javascript;base64," + btoa(request.code);
          dynamicImport(dataUri).then((templateLogicConstructor) => {
            const instance = new templateLogicConstructor();
            if (!request.functionName) {
              throw new Error("No function name specified for template logic");
            }
            result = instance[request.functionName](...request.arguments);
            const end = (/* @__PURE__ */ new Date()).getTime();
            resolve({ result, elapsed: end - start });
          }).catch((err) => {
            console.log(err);
            reject({
              message: err.message
            });
          });
        }
      } catch (err) {
        console.log(err);
        reject({
          message: err.message
        });
      }
    });
  }
  /**
   * Evaluates a JS function using a node child process
   * @param {EvalRequest} request the eval request
   * @param {EvalOptions} options the options for the request
   * @returns {Promise<EvalResponse>} the async result
   */
  async evalChildProcess(request, options = { timeout: 1e4 }) {
    return new Promise((resolve, reject) => {
      const now = (/* @__PURE__ */ new Date()).getTime();
      const workItem = {
        startTime: now,
        expireTime: now + options.timeout,
        request,
        resolve,
        reject
      };
      if (this.queue.length >= this.options.maxQueueDepth) {
        reject({ maxQueueDepthExceeded: true, elapsed: 0 });
      }
      this.queue.push(workItem);
      this.processQueue(options);
    });
  }
  processQueue(options) {
    const now = (/* @__PURE__ */ new Date()).getTime();
    const notExpired = this.queue.filter((w) => now < w.expireTime);
    const expired = this.queue.filter((w) => now >= w.expireTime);
    this.queue = notExpired;
    expired.forEach((w) => {
      w.reject({ timeout: true, starvation: true, elapsed: now - w.startTime });
    });
    if (this.workers.length < this.options.maxWorkers) {
      const next = this.queue.shift();
      if (next) {
        this.doWork(next, options).then((result) => next.resolve(result)).catch((error) => next.reject(error));
      }
    } else {
      sleep(this.options.waitInterval).then(() => {
        this.processQueue(options);
      });
    }
  }
  getWorkerPath() {
    try {
      const thisPath = require.resolve("@accordproject/template-engine");
      return path.join(thisPath, "..", "worker.js");
    } catch (err) {
      return path.join(__dirname, "..", "dist", "worker.js");
    }
  }
  doWork(work, options) {
    return new Promise((resolve, reject) => {
      const start = (/* @__PURE__ */ new Date()).getTime();
      if (!child_process.fork) {
        reject({ message: "Cannot use evalChildProcess because child_process.fork is not defined." });
      }
      const workerPath = this.getWorkerPath();
      const worker = child_process.fork(workerPath, { timeout: options.timeout, env: {} });
      if (!worker.pid) {
        throw new Error("Failed to fork child process");
      }
      this.workers.push(worker);
      work.pid = worker.pid;
      let result;
      worker.on("error", (err) => {
        this.workers = this.workers.filter((w) => w.pid !== worker.pid);
        const end = (/* @__PURE__ */ new Date()).getTime();
        reject({ message: err.message, elapsed: end - start });
      });
      worker.on("message", (msg) => {
        result = msg;
      });
      worker.on("exit", (code) => {
        if (code === null) {
          this.workers = this.workers.filter((w) => w.pid !== worker.pid);
          const end = (/* @__PURE__ */ new Date()).getTime();
          reject({ timeout: true, elapsed: end - start });
        } else if (code === 0 && result) {
          this.workers = this.workers.filter((w) => w.pid !== worker.pid);
          const end = (/* @__PURE__ */ new Date()).getTime();
          resolve({ ...result, elapsed: end - start });
        } else {
          this.workers = this.workers.filter((w) => w.pid !== worker.pid);
          const end = (/* @__PURE__ */ new Date()).getTime();
          reject({ code, result, elapsed: end - start });
        }
      });
      worker.send(work.request);
    });
  }
}

function checkCode(code) {
  if (code.type !== CodeType.ES_2020) {
    throw new Error(`Cannot run ${code.contents} as it is not ES_2020 JavaScript.`);
  }
}
const javaScriptEvaluator = browserOrNode.isBrowser ? new JavaScriptEvaluator() : new JavaScriptEvaluator({
  maxWorkers: process.env.MAX_WORKERS ? Number.parseInt(process.env.MAX_WORKERS) : os.availableParallelism(),
  // how many child processes
  waitInterval: process.env.WAIT_INTERVAL ? Number.parseInt(process.env.WAIT_INTERVAL) : 50,
  // how long to wait before rescheduling work
  maxQueueDepth: process.env.MAX_QUEUE_DEPTH ? Number.parseInt(process.env.MAX_QUEUE_DEPTH) : 1e3
  // max requests to queue
});
const TEMPLATEMARK_ROOT_NODES = [
  "org.accordproject.templatemark@0.5.0.ClauseDefinition",
  "org.accordproject.templatemark@0.5.0.ContractDefinition"
];
const DOCUMENT_ROOT = "org.accordproject.commonmark@0.5.0.Document";
async function evaluateJavaScript(clauseLibrary, data, fn, options) {
  if (options?.disableJavaScriptEvaluation) {
    throw new Error("JavaScript evaluation is disabled.");
  }
  if (!data || !fn) {
    throw new Error(`Cannot evaluate JS ${fn} against ${data}`);
  }
  const functionArgNames = new Array();
  functionArgNames.push("data");
  functionArgNames.push("library");
  functionArgNames.push("options");
  const functionArgValues = new Array();
  functionArgValues.push(data);
  functionArgValues.push(clauseLibrary);
  functionArgValues.push(options);
  const expression = fn.substring(fn.indexOf("{") + 1, fn.lastIndexOf("}"));
  if (expression.trim().length === 0) {
    throw new Error("Empty expression");
  }
  try {
    const request = { code: expression, argumentNames: functionArgNames, arguments: functionArgValues };
    if (options?.childProcessJavaScriptEvaluation) {
      if (browserOrNode.isBrowser) {
        throw new Error("Child process evaluation is not supported inside web browser");
      }
      const evalOptions = options?.timeout ? { timeout: options.timeout } : void 0;
      const r = await javaScriptEvaluator.evalChildProcess(request, evalOptions);
      return r;
    } else {
      const r = await javaScriptEvaluator.evalDangerously(request);
      return r;
    }
  } catch (err) {
    throw new Error(`Caught error ${JSON.stringify(err)} evaluating ${expression} with arguments ${JSON.stringify(functionArgValues)}`);
  }
}
function getJsonPath(rootData, currentNode, paths) {
  if (!currentNode) {
    throw new Error("Node must be supplied");
  }
  if (!currentNode.name) {
    throw new Error(`Node must have a name: ${JSON.stringify(currentNode)}`);
  }
  if (currentNode.name.indexOf(".") >= 0) {
    throw new Error(`Invalid name property ${currentNode.name}`);
  }
  if (!paths || !paths.length || paths.length < 1) {
    throw new Error("Paths must be supplied");
  }
  const withPath = [];
  for (let n = 1; n < paths.length; n++) {
    const sub = paths.slice(0, n);
    const obj = traverse.get(rootData, sub);
    if (obj && obj.$class) {
      if (NAVIGATION_NODES.indexOf(obj.$class) >= 0) {
        if (obj.name !== "top") {
          withPath.push(`['${obj.name}']`);
        }
      }
    }
  }
  if (currentNode.name !== "this") {
    withPath.push(`['${currentNode.name}']`);
  }
  return withPath.length > 0 ? `$${withPath.join("")}` : "$";
}
async function evaluateUserCode(clauseLibrary, templateMark, data, options) {
  const result = {};
  const paths = traverse(templateMark).paths();
  for (let n = 0; n < paths.length; n++) {
    const path = paths[n];
    const context = traverse(templateMark).get(path);
    if (typeof context === "object" && context.$class && typeof context.$class === "string") {
      const nodeClass = context.$class;
      if (FORMULA_DEFINITION_RE.test(nodeClass)) {
        if (context.code) {
          checkCode(context.code);
          const evalResponse = await evaluateJavaScript(clauseLibrary, data, context.code.contents, options);
          result[path.join("/")] = JSON.stringify(evalResponse.result);
        } else {
          throw new Error("Formula node is missing code.");
        }
      } else if (CONDITIONAL_DEFINITION_RE.test(nodeClass) || CLAUSE_DEFINITION_RE.test(nodeClass)) {
        if (context.condition) {
          checkCode(context.condition);
          const evalResponse = await evaluateJavaScript(clauseLibrary, data, context.condition.contents, options);
          result[path.join("/")] = JSON.stringify(evalResponse.result);
        }
      }
    }
  }
  return result;
}
async function generateOptionalBlocks(modelManager, clauseLibrary, templateMark, data, options) {
  const result = {};
  const paths = traverse(templateMark).paths();
  for (let n = 0; n < paths.length; n++) {
    const thisPath = paths[n];
    const context = traverse(templateMark).get(thisPath);
    if (typeof context === "object" && context.$class && typeof context.$class === "string") {
      const nodeClass = context.$class;
      if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
        const path = getJsonPath(templateMark, context, thisPath);
        const variableValues = jp.query(data, path, 1);
        if (variableValues.length > 0) {
          const optionalPropertyValue = variableValues[0];
          if (context.whenSome && context.whenSome.length > 0) {
            const whenSomeParagraph = {
              $class: "org.accordproject.commonmark@0.5.0.Paragraph",
              nodes: context.whenSome
            };
            const subResult = await generateAgreement(modelManager, clauseLibrary, whenSomeParagraph, optionalPropertyValue, options);
            result[thisPath.join("/")] = subResult.nodes ? subResult.nodes : [];
          } else {
            result[thisPath.join("/")] = [];
          }
        }
      }
    }
  }
  return result;
}
async function generateRecursiveBlocks(modelManager, clauseLibrary, templateMark, data, nodeRegExp, childNodeClass, options) {
  const result = {};
  const paths = traverse(templateMark).paths();
  for (let n = 0; n < paths.length; n++) {
    const thisPath = paths[n];
    const context = traverse(templateMark).get(thisPath);
    if (typeof context === "object" && context.$class && typeof context.$class === "string") {
      const nodeClass = context.$class;
      if (nodeRegExp.test(nodeClass)) {
        const path = getJsonPath(templateMark, context, thisPath);
        const variableValues = jp.query(data, path, 1);
        if (variableValues.length === 0) {
          throw new Error(`No values found for path '${path}' in data ${JSON.stringify(data)}.`);
        } else {
          const arrayData = variableValues[0];
          if (!Array.isArray(arrayData)) {
            throw new Error(`Values found for path '${path}' in data ${data} is not an array: ${arrayData}.`);
          } else {
            const nodes = [];
            for (let n2 = 0; n2 < arrayData.length; n2++) {
              const arrayItem = arrayData[n2];
              const subResult = await generateAgreement(modelManager, clauseLibrary, context.nodes[0].nodes[0], arrayItem, options);
              nodes.push({
                $class: childNodeClass,
                nodes: subResult.nodes ? subResult.nodes : []
              });
            }
            result[thisPath.join("/")] = nodes;
          }
        }
      }
    }
  }
  return result;
}
async function generateAgreement(modelManager, clauseLibrary, templateMark, data, options) {
  const introspector = new concertoCore.Introspector(modelManager);
  const userCodeResults = await evaluateUserCode(clauseLibrary, templateMark, data, options);
  const listBlockResults = await generateRecursiveBlocks(modelManager, clauseLibrary, templateMark, data, LISTBLOCK_DEFINITION_RE, `${markdownCommon.CommonMarkModel.NAMESPACE}.Item`, options);
  const foreachBlockResults = await generateRecursiveBlocks(modelManager, clauseLibrary, templateMark, data, FOREACH_DEFINITION_RE, `${markdownCommon.CommonMarkModel.NAMESPACE}.Paragraph`, options);
  const optionalBlockResults = await generateOptionalBlocks(modelManager, clauseLibrary, templateMark, data, options);
  return traverse(templateMark).map(function(context) {
    let stopHere = false;
    if (typeof context === "object" && context.$class && typeof context.$class === "string") {
      const nodeClass = context.$class;
      const match = nodeClass.match(TEMPLATEMARK_RE);
      if (match && match.length > 1) {
        context.$class = `${markdownCommon.CiceroMarkModel.NAMESPACE}.${match[3]}`;
      }
      if (CONTRACT_DEFINITION_RE.test(nodeClass)) {
        context.$class = `${markdownCommon.CommonMarkModel.NAMESPACE}.Paragraph`;
        delete context.name;
        delete context.elementType;
      }
      if (WITH_DEFINITION_RE.test(nodeClass)) {
        context.$class = `${markdownCommon.CommonMarkModel.NAMESPACE}.Paragraph`;
        delete context.name;
        delete context.elementType;
      } else if (FORMULA_DEFINITION_RE.test(nodeClass)) {
        if (context.code) {
          const result = userCodeResults[this.path.join("/")];
          if (result === null) {
            context.value = "<null>";
          } else if (typeof result === "string") {
            context.value = result;
          } else {
            context.value = JSON.stringify(result);
          }
          delete context.code;
        } else {
          throw new Error("Formula node is missing code.");
        }
      } else if (LISTBLOCK_DEFINITION_RE.test(nodeClass)) {
        context.$class = `${markdownCommon.CommonMarkModel.NAMESPACE}.List`;
        delete context.elementType;
        delete context.name;
        context.nodes = listBlockResults[this.path.join("/")];
        stopHere = true;
      } else if (JOIN_DEFINITION_RE.test(nodeClass)) {
        const path = getJsonPath(templateMark, context, this.path);
        const variableValues = jp.query(data, path, 1);
        if (variableValues.length === 0) {
          throw new Error(`No values found for path '${path}' in data ${JSON.stringify(data)}.`);
        } else {
          const arrayData = variableValues[0];
          if (!Array.isArray(arrayData)) {
            throw new Error(`Values found for path '${path}' in data ${data} is not an array: ${arrayData}.`);
          } else {
            context.$class = `${markdownCommon.CommonMarkModel.NAMESPACE}.Text`;
            const drafter = getDrafter(context.elementType);
            context.text = joinList(arrayData.map((arrayItem) => {
              return drafter ? drafter(arrayItem, context.format) : arrayItem;
            }), context, options);
            delete context.elementType;
            delete context.name;
            delete context.separator;
            delete context.locale;
            delete context.type;
            delete context.style;
            delete context.nodes;
            stopHere = true;
          }
        }
      } else if (FOREACH_DEFINITION_RE.test(nodeClass)) {
        context.$class = `${markdownCommon.CommonMarkModel.NAMESPACE}.Foreach`;
        delete context.elementType;
        delete context.name;
        context.nodes = foreachBlockResults[this.path.join("/")];
        stopHere = true;
      } else if (VARIABLE_DEFINITION_RE.test(nodeClass) || ENUM_VARIABLE_DEFINITION_RE.test(nodeClass) || FORMATTED_VARIABLE_DEFINITION_RE.test(nodeClass)) {
        if (typeof data === "object") {
          const path = getJsonPath(templateMark, context, this.path);
          const variableValues = jp.query(data, path, 1);
          if (variableValues.length === 0) {
            throw new Error(`No values found for path '${path}' in data ${JSON.stringify(data)}.`);
          } else {
            const variableValue = variableValues[0];
            const type = concertoCore.ModelUtil.isPrimitiveType(context.elementType) ? null : introspector.getClassDeclaration(context.elementType);
            const drafter = getDrafter(type && type.isEnum() ? "String" : context.elementType);
            context.value = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue);
          }
        } else {
          const variableValue = data;
          const type = concertoCore.ModelUtil.isPrimitiveType(context.elementType) ? null : introspector.getClassDeclaration(context.elementType);
          const drafter = getDrafter(type && type.isEnum() ? "String" : context.elementType);
          context.value = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue);
        }
      } else if (CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
        if (context.condition) {
          const result = userCodeResults[this.path.join("/")];
          context.isTrue = !!result;
        } else {
          const path = getJsonPath(templateMark, context, this.path);
          const variableValues = jp.query(data, path, 1);
          if (variableValues && variableValues.length) {
            if (variableValues.length === 1) {
              context.isTrue = !!variableValues[0];
            } else {
              throw new Error(`Multiple values found for path '${path}' in data ${data}.`);
            }
          } else {
            context.isTrue = false;
          }
        }
        context.nodes = context.isTrue ? context.whenTrue : context.whenFalse;
        delete context.condition;
        delete context.dependencies;
        delete context.functionName;
      } else if (CLAUSE_DEFINITION_RE.test(nodeClass)) {
        const path = getJsonPath(templateMark, context, this.path);
        const variableValues = jp.query(data, path, 1);
        if (context.name !== "top" && (variableValues.length === 0 || variableValues[0] === void 0 || variableValues[0] === null)) {
          delete context.nodes;
          stopHere = true;
        } else if (context.condition) {
          checkCode(context.condition);
          const result = !!userCodeResults[this.path.join("/")];
          if (!result) {
            delete context.nodes;
            stopHere = true;
          }
        }
        delete context.condition;
        delete context.functionName;
      } else if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
        const path = getJsonPath(templateMark, context, this.path);
        const variableValues = jp.query(data, path, 1);
        if (variableValues && variableValues.length) {
          if (variableValues.length === 1) {
            context.hasSome = true;
            context.whenNone = [];
            if (optionalBlockResults[this.path.join("/")]) {
              context.nodes = optionalBlockResults[this.path.join("/")];
              context.whenSome = [];
              stopHere = true;
            } else {
              context.nodes = context.whenSome;
            }
          } else {
            throw new Error(`Multiple values found for path '${path}' in data ${data}.`);
          }
        } else {
          context.hasSome = false;
          context.whenSome = [];
          context.nodes = context.whenNone;
        }
      }
    }
    this.update(context, stopHere);
  });
}
class TemplateMarkInterpreter {
  constructor(modelManager, clauseLibrary, templateConceptFqn) {
    this.modelManager = modelManager;
    this.clauseLibrary = clauseLibrary;
    this.templateClass = getTemplateClassDeclaration(this.modelManager, templateConceptFqn);
  }
  /**
   * Checks that a TemplateMark JSON document is valid with respect to the
   * TemplateMark model, as well as the template model.
   *
   * Checks:
   * 1. Variable names are valid properties in the template model
   * 2. Optional properties have guards
   * @param {*} templateMark the TemplateMark JSON object
   * @returns {*} TemplateMark JSON that has been typed checked and has type metadata added
   * @throws {Error} if the templateMark document is invalid
   */
  checkTypes(templateMark) {
    const modelManager = new concertoCore.ModelManager({ strict: true });
    modelManager.addCTOModel(markdownCommon.ConcertoMetaModel.MODEL, "concertometamodel.cto");
    modelManager.addCTOModel(markdownCommon.CommonMarkModel.MODEL, "commonmark.cto");
    modelManager.addCTOModel(markdownCommon.TemplateMarkModel.MODEL, "templatemark.cto");
    const factory = new concertoCore.Factory(modelManager);
    const serializer = new concertoCore.Serializer(factory, modelManager);
    try {
      serializer.fromJSON(templateMark);
    } catch (err) {
      throw new Error(`Generated invalid agreement: ${err}: ${JSON.stringify(templateMark, null, 2)}`);
    }
    const errors = [];
    const templateClass = this.templateClass;
    const guardBlockPaths = /* @__PURE__ */ new Map();
    traverse(templateMark).forEach(function(node) {
      if (!node || typeof node !== "object" || !node.$class) return;
      const currentPath = this.path.join("/");
      if (OPTIONAL_DEFINITION_RE.test(node.$class) || CONDITIONAL_DEFINITION_RE.test(node.$class) || WITH_DEFINITION_RE.test(node.$class)) {
        guardBlockPaths.set(node.name, currentPath);
      }
      if (VARIABLE_DEFINITION_RE.test(node.$class) || ENUM_VARIABLE_DEFINITION_RE.test(node.$class) || FORMATTED_VARIABLE_DEFINITION_RE.test(node.$class)) {
        const propName = node.name;
        if (propName && propName !== "this") {
          try {
            const property = templateClass.getProperty(propName);
            if (property && property.isOptional()) {
              const guardPath = guardBlockPaths.get(propName);
              const isGuarded = guardPath !== void 0 && (currentPath === guardPath || currentPath.startsWith(guardPath + "/"));
              if (!isGuarded) {
                errors.push({
                  propertyName: propName,
                  message: `Optional property '${propName}' is used without a guard. Wrap it in {{#optional ${propName}}}...{{/optional}} or {{#if ${propName}}}...{{/if}}.`
                });
              }
            }
          } catch {
          }
        }
      }
    });
    if (errors.length > 0) {
      const errorMessage = `Optional properties used without guards: ${errors.map((e) => e.propertyName).join(", ")}`;
      const error = new Error(errorMessage);
      error.errors = errors;
      throw error;
    }
    return templateMark;
  }
  /**
   * Compiles the code nodes containing TS to code nodes containing JS.
   * @param {*} templateMark the TemplateMark JSON object
   * @returns {*} TemplateMark JSON with JS nodes
   * @throws {Error} if the templateMark document is invalid
   */
  async compileTypeScriptToJavaScript(templateMark) {
    const clazz = templateMark.$class;
    if (clazz !== DOCUMENT_ROOT) {
      throw new Error(`JSON is not CommonMark. $class is '${clazz}'. ${JSON.stringify(templateMark, null, 2)}`);
    }
    if (!templateMark.nodes || !templateMark.nodes.length || templateMark.nodes.length < 1) {
      throw new Error(`CommonMark does not have nodes: ${JSON.stringify(templateMark, null, 2)}`);
    }
    const firstChild = templateMark.nodes[0];
    const firstChildClazz = firstChild.$class;
    if (!TEMPLATEMARK_ROOT_NODES.includes(firstChildClazz)) {
      throw new Error(`First child is not templatemark. $class is '${firstChildClazz}'. ${JSON.stringify(templateMark, null, 2)}`);
    }
    const templateConcept = firstChild.elementType;
    if (!templateConcept) {
      throw new Error(`First child is not typed: ${JSON.stringify(templateMark, null, 2)}`);
    }
    if (firstChild.name !== "top") {
      throw new Error('First child is not named "top"!');
    }
    const compiler = new TemplateMarkToJavaScriptCompiler(this.modelManager, templateConcept);
    await compiler.initialize();
    return compiler.compile(templateMark);
  }
  validateCiceroMark(ciceroMark) {
    const modelManager = new concertoCore.ModelManager({ strict: true });
    modelManager.addCTOModel(markdownCommon.ConcertoMetaModel.MODEL, "concertometamodel.cto");
    modelManager.addCTOModel(markdownCommon.CommonMarkModel.MODEL, "commonmark.cto");
    modelManager.addCTOModel(markdownCommon.CiceroMarkModel.MODEL, "ciceromark.cto");
    const factory = new concertoCore.Factory(modelManager);
    const serializer = new concertoCore.Serializer(factory, modelManager);
    try {
      return serializer.fromJSON(ciceroMark);
    } catch (err) {
      throw new Error(`Generated invalid agreement: ${err}: ${JSON.stringify(ciceroMark, null, 2)}`);
    }
  }
  async generate(templateMark, data, options) {
    const factory = new concertoCore.Factory(this.modelManager);
    const serializer = new concertoCore.Serializer(factory, this.modelManager);
    const templateData = serializer.fromJSON(data);
    if (templateData.getFullyQualifiedType() !== this.templateClass.getFullyQualifiedName()) {
      throw new Error(`Template data must be of type '${this.templateClass.getFullyQualifiedName()}'.`);
    }
    const typedTemplateMark = this.checkTypes(templateMark);
    const jsTemplateMark = await this.compileTypeScriptToJavaScript(typedTemplateMark);
    const ciceroMark = await generateAgreement(this.modelManager, this.clauseLibrary, jsTemplateMark, data, options);
    return this.validateCiceroMark(ciceroMark);
  }
}

const ENTRY_TS = "logic/logic.ts";
class TemplateLogicBundler {
  constructor(template) {
    this.template = template;
  }
  /**
   * Convenience wrapper: transpile and return the bundled code, throwing on
   * any error. Used by `TemplateArchiveProcessor` for JIT execution.
   */
  async bundle(options = {}) {
    const result = await this.transpile(options);
    if (result.errors.length > 0) {
      throw new Error(
        `TemplateLogicBundler: compilation failed
${result.errors.join("\n")}`
      );
    }
    if (!result.code) {
      throw new Error("TemplateLogicBundler: webpack produced no output");
    }
    return result.code;
  }
  /**
   * Transpile the TypeScript template logic to a bundled ESM JavaScript module.
   *
   * This is the JIT compilation path from PR #50. Type-checking is NOT
   * performed — only syntax transformation via `ts.transpileModule()`.
   *
   * @param options  compilation options
   * @param outputDirectory  if provided, write the bundle to disk and flip
   *                         `package.json` to `runtime: "es6"` (offline mode)
   */
  async transpile(options = {}, outputDirectory) {
    const sources = this.collectSources();
    if (!sources.has(ENTRY_TS)) {
      return {
        errors: [
          `Template logic entry point '${ENTRY_TS}' not found in archive. Available .ts scripts: ${[...sources.keys()].join(", ") || "(none)"}`
        ]
      };
    }
    const runtimeTs = Buffer.from(SMART_LEGAL_CONTRACT_BASE64, "base64").toString();
    const runtimeJs = typescript.transpileModule(runtimeTs, {
      compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 }
    }).outputText;
    const vol = new memfs.Volume();
    for (const [relPath, src] of sources.entries()) {
      const jsPath = "/" + relPath.replace(/\.ts$/, ".js");
      let js = typescript.transpileModule(src, {
        compilerOptions: {
          module: typescript.ModuleKind.ESNext,
          target: typescript.ScriptTarget.ES2022,
          esModuleInterop: true
        }
      }).outputText;
      if (relPath === ENTRY_TS) {
        js = `${runtimeJs}
${js}`;
      }
      vol.mkdirSync(path.posix.dirname(jsPath), { recursive: true });
      vol.writeFileSync(jsPath, js);
    }
    const memfsInstance = memfs.createFsFromVolume(vol);
    const realNodeModules = path.resolve(__dirname, "..", "node_modules");
    const lfs = linkfs.link(memfsInstance, [["/node_modules", realNodeModules]]);
    const inputFs = new unionfs.Union();
    inputFs.use(lfs);
    const outputVol = new memfs.Volume();
    const outputFs = memfs.createFsFromVolume(outputVol);
    return new Promise((resolve) => {
      const compiler = webpack({
        mode: "production",
        entry: "/logic/logic.js",
        output: {
          path: "/dist",
          filename: "bundle.js",
          library: { type: "module" },
          chunkFormat: "module"
        },
        experiments: { outputModule: true },
        resolve: { extensions: [".js"] },
        // Disable minification so the output remains readable and the
        // data-URI round-trip through btoa/atob doesn't hit size issues.
        optimization: { minimize: false },
        // Suppress the default Node.js target polyfills — template logic
        // runs directly in Node.js and doesn't need browser shims.
        target: "node"
      });
      compiler.inputFileSystem = inputFs;
      compiler.outputFileSystem = outputFs;
      compiler.run((err, stats) => {
        compiler.close(() => {
        });
        if (err) {
          resolve({ errors: [err.message] });
          return;
        }
        if (stats?.hasErrors()) {
          const errs = stats.toJson({ errors: true }).errors?.map((e) => e.message) ?? ["webpack compilation error"];
          resolve({ errors: errs });
          return;
        }
        if (options.verbose && stats) {
          console.log(stats.toString({ colors: false }));
        }
        const code = outputVol.readFileSync("/dist/bundle.js");
        const codeStr = code.toString("utf8");
        if (outputDirectory) {
          this.writeToDisk(outputDirectory, codeStr);
        }
        resolve({ code: codeStr, errors: [] });
      });
    });
  }
  /**
   * Write the compiled bundle to disk and update the template's `package.json`
   * to declare `runtime: "es6"`, enabling the pre-bundled execution mode on
   * subsequent runs (no recompilation needed).
   */
  writeToDisk(outputDirectory, code) {
    const logicJsPath = path.join(outputDirectory, "logic", "logic.js");
    fs.mkdirSync(path.dirname(logicJsPath), { recursive: true });
    fs.writeFileSync(logicJsPath, code, "utf8");
    const pkgPath = path.join(outputDirectory, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.accordproject) {
        pkg.accordproject.runtime = "es6";
      }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    }
  }
  /**
   * Collect the template's `.ts` sources from the ScriptManager.
   * Excludes `.d.ts` declaration files and compiled `dist/` artefacts.
   * Keyed by normalised forward-slash path relative to the template root.
   */
  collectSources() {
    const scripts = this.template.getLogicManager().getScriptManager().getScriptsForTarget("typescript");
    const map = /* @__PURE__ */ new Map();
    for (const s of scripts) {
      const id = s.getIdentifier();
      if (!id.endsWith(".ts") || id.endsWith(".d.ts")) continue;
      const norm = id.replace(/\\/g, "/");
      if (norm.split("/").includes("dist")) continue;
      map.set(norm, s.getContents());
    }
    return map;
  }
}

class TemplateArchiveProcessor {
  /**
   * Creates a template archive processor
   * @param {Template} template - the template to be used by the processor
   */
  constructor(template) {
    this.template = template;
  }
  /**
   * Drafts a template by merging it with data
   * @param {any} data the data to merge with the template
   * @param {string} format the output format
   * @param {any} options merge options
   * @param {[string]} currentTime the current value for 'now'
   * @returns {Promise} the drafted content
   */
  async draft(data, format, options, currentTime) {
    const metadata = this.template.getMetadata();
    const templateKind = metadata.getTemplateType() !== 0 ? "clause" : "contract";
    const modelManager = this.template.getModelManager();
    const engine = new TemplateMarkInterpreter(modelManager, {});
    const templateMarkTransformer = new markdownTemplate.TemplateMarkTransformer();
    const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
      { content: this.template.getTemplate() },
      modelManager,
      templateKind,
      { options }
    );
    const now = currentTime ? currentTime : (/* @__PURE__ */ new Date()).toISOString();
    const ciceroMark = await engine.generate(templateMarkDom, data, { now });
    const result = markdownTransform.transform(ciceroMark.toJSON(), "ciceromark", ["ciceromark_unquoted", format], null, options);
    return result;
  }
  /**
   * Trigger the logic of a template
   * @param {object} data - the contract/clause data
   * @param {object} request - the request to send to the template logic
   * @param {object} state - the current state of the template
   * @param {[string]} currentTime - the current time, defaults to now
   * @param {[number]} utcOffset - the UTC offset, defaults to zero
   * @returns {Promise} the response and any events
   */
  async trigger(data, request, state, currentTime, utcOffset) {
    const code = await this._getLogicCode();
    const evaluator = new JavaScriptEvaluator();
    const evalResponse = await evaluator.evalDangerously({
      templateLogic: true,
      verbose: false,
      functionName: "trigger",
      code,
      argumentNames: ["data", "request", "state"],
      arguments: [data, request, state, currentTime, utcOffset]
    });
    if (evalResponse.result) {
      return evalResponse.result;
    }
    throw new Error("Trigger failed with message: " + evalResponse.message);
  }
  /**
   * Init the logic of a template
   * @param {object} data - the contract/clause data
   * @param {[string]} currentTime - the current time, defaults to now
   * @param {[number]} utcOffset - the UTC offset, defaults to zero
   * @returns {Promise} the initial state
   */
  async init(data, currentTime, utcOffset) {
    const code = await this._getLogicCode();
    const evaluator = new JavaScriptEvaluator();
    const evalResponse = await evaluator.evalDangerously({
      templateLogic: true,
      verbose: false,
      functionName: "init",
      code,
      argumentNames: ["data"],
      arguments: [data, currentTime, utcOffset]
    });
    if (evalResponse.result) {
      return evalResponse.result;
    }
    throw new Error("Init failed with message: " + evalResponse.message);
  }
  /**
   * Transpile the TypeScript template logic to a pre-built JavaScript bundle
   * (static / offline compilation — Mode 1 from PR #50).
   *
   * If `outputDirectory` is provided the bundle is written to
   * `<outputDirectory>/logic/logic.js` and the template's `package.json` is
   * updated to `runtime: "es6"` so that subsequent calls to `trigger()` /
   * `init()` skip recompilation entirely.
   *
   * @param outputDirectory  optional directory to write the compiled artifact
   * @returns the compiler result containing the bundled code and any errors
   */
  async transpileLogicToJavaScript(outputDirectory) {
    const language = this.template.getLogicManager().getLanguage();
    if (language !== "typescript") {
      throw new Error(
        `transpileLogicToJavaScript() requires a TypeScript archive (runtime: "typescript"), but this archive has runtime: "${language}".`
      );
    }
    return new TemplateLogicBundler(this.template).transpile({}, outputDirectory);
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Resolve the ready-to-eval JavaScript source for the template logic,
   * dispatching on the archive's declared runtime mode.
   */
  async _getLogicCode() {
    const logicManager = this.template.getLogicManager();
    const language = logicManager.getLanguage();
    switch (language) {
      case "es6": {
        const scripts = logicManager.getScriptManager().getScriptsForTarget("es6");
        if (!scripts || scripts.length === 0) {
          throw new Error(
            `No es6 logic found in template archive. Run transpileLogicToJavaScript() to produce a pre-built bundle.`
          );
        }
        const entry = scripts.find(
          (s) => s.getIdentifier().replace(/\\/g, "/").endsWith("logic/logic.js")
        ) ?? scripts[0];
        return entry.getContents();
      }
      case "typescript": {
        const result = await new TemplateLogicBundler(this.template).transpile();
        if (result.errors.length > 0) {
          throw new Error(
            `TypeScript JIT compilation failed:
${result.errors.join("\n")}`
          );
        }
        if (!result.code) {
          throw new Error("TypeScript JIT compilation produced no output");
        }
        return result.code;
      }
      default:
        throw new Error(
          `Unsupported template logic runtime: '${language}'. Expected 'typescript' (JIT) or 'es6' (pre-bundled).`
        );
    }
  }
}

exports.TemplateArchiveProcessor = TemplateArchiveProcessor;
exports.TemplateMarkInterpreter = TemplateMarkInterpreter;
exports.ensureDirSync = ensureDirSync;
exports.getTemplateClassDeclaration = getTemplateClassDeclaration;
exports.nameUserCode = nameUserCode;
exports.removeSync = removeSync;
exports.writeFunctionToString = writeFunctionToString;
//# sourceMappingURL=index.js.map
