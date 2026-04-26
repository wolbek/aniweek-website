const {
  RegExpMatcher,
  TextCensor,
  englishDataset,
  englishRecommendedTransformers,
  asteriskCensorStrategy,
} = require("obscenity");

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const censor = new TextCensor().setStrategy(asteriskCensorStrategy());

function censorText(text) {
  const matches = matcher.getAllMatches(text);
  return censor.applyTo(text, matches);
}

module.exports = { censorText };
