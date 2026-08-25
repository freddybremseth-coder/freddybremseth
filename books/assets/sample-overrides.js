(function () {
  var overrides = {
    "jeg-er-ikke-et-eksempel": "assets/samples/nonfiction/jeg_er_ikke_et_eksempel_reading_sample.pdf",
    "lev-100-ar": "assets/samples/nonfiction/lev_til_du_er_100_ar_reading_sample.pdf",
    "my-journey-as-a-father": "assets/samples/nonfiction/my_journey_as_a_father_reading_sample.pdf"
  };
  window.BOOK_SAMPLE_OVERRIDES = overrides;
  (window.BOOKS_SERIES || []).forEach(function (series) {
    (series.books || []).forEach(function (book) {
      if (overrides[book.id]) book.samplePath = overrides[book.id];
    });
  });
})();
