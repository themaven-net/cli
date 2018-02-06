const css = require('css')
const camelCase = require('lodash/camelCase')

/**
 * Convert css to jss.
 *
 * @param {Object} options
 * @return {Object}
 * @api public
 */
module.exports = function (options) {
  const ast = css.parse(options.code)
  let styles = {}
  if (ast.stylesheet && ast.stylesheet.rules) {
    styles = toJssRules(ast.stylesheet.rules, options)
  }
  return styles
}

/**
 * Convert rules from css ast to jss style.
 *
 * @param {Array} cssRules
 * @param {Object} options
 * @return {Object}
 */
function toJssRules(cssRules, options) {
  const jssRules = {}

  function stripUnit(value) {
    if (
      !options.unit ||
      // Detect a compound/multi value.
      /\s|,/.test(value)
    ) return value

    const unit = value.substr(value.length - options.unit.length)
    const num = parseFloat(value)
    if (unit === options.unit && num !== NaN) {
      return num
    }
    return value
  }

  function addRule(rule, rules) {
    if (rule.type === 'comment') return
    const key = rule.selectors.join(', ')
    const style = rules[key] || (rules[key] = {})
    rule.declarations.forEach(function (decl) {
      if (decl.type === 'comment') return
      const property = formatProp(decl.property)
      if (property in style) {
        const fallbacks = style.fallbacks || (style.fallbacks = [])
        fallbacks.splice(0, 0, { [property]: style[property] })
      }
      style[property] = stripUnit(decl.value)
    })
  }

  function formatProp(prop) {
    return options.dashes ? prop : camelCase(prop)
  }

  function embedStyles(rules, level = 0) {
    // recurse rules, clean up dots
    Object.entries(rules).forEach(([rule, v]) => {
      // If this rule is a media rule, recursively call embedStyles, going in one level deeper to build the set of rules
      // for the media rule.
      if (rule.indexOf('@media') > -1) {
        embedStyles(v, level + 1)
        return
      }
      // split rule by comma, and process each rule independently.
      var ruleParts = rule.split(',')
      for(var rulePart of ruleParts) {
        var left = rulePart.trim()
        if (left.indexOf('.') == 0) {
          // if the first rule is a class, treat it like a top level js property and remove  from our source rules.
          left = left.substr(1)
          delete rules[rule]
        }
        var spaceIndex
        var first = null
        var p = rules
        var level = 0
        if((spaceIndex = left.search(/\s|\./)) > -1) {
          first = left.substring(0, spaceIndex)
          // if space index is a ' ' then we want to skip it when we grab the remainder, otherwise, if it's a '.', we
          // want to include it.
          const cutOffset = left[spaceIndex] === ' ' ? 1 : 0
          left = left.substring(spaceIndex + cutOffset)
          var firstKey = first
          if (!p[firstKey]) {
            p[firstKey] = {}
          }
          p = p[firstKey]
        } else {
          rules[left] = v
        }
        // first is the last token in the string
        if (first && left) {
          var key = left.startsWith('&') ? left : '& ' + left
          if (p[key]) {
            p[key] = {...p[key], ...v}
          } else {
            p[key] = v
          }
          delete rules[rule]
        }
      }
    })
  }


  cssRules.forEach(function (rule) {
    if (rule.type === 'comment') return
    switch (rule.type) {
      case 'rule':
        addRule(rule, jssRules)
        break
      case 'media': {
        const key = '@media ' + rule.media
        const value = jssRules[key] || (jssRules[key] = {})
        rule.rules.forEach(function(rule) {
          addRule(rule, value)
        })
        break
      }
      case 'font-face': {
        const key = '@' + rule.type
        const value = jssRules[key] || (jssRules[key] = {})
        rule.declarations.forEach(function (decl) {
          value[formatProp(decl.property)] = decl.value
        })
        break
      }
      case 'keyframes': {
        const key = '@' + rule.type + ' ' + rule.name
        const value = jssRules[key] || (jssRules[key] = {})
        rule.keyframes.forEach(function (keyframe) {
          const frameKey = keyframe.values.join(', ')
          const frameValue = value[frameKey] || (value[frameKey] = {})
          keyframe.declarations.forEach(function (decl) {
            frameValue[formatProp(decl.property)] = stripUnit(decl.value)
          })
        })
      }
    }
  })

  embedStyles(jssRules)

  return jssRules
}
