'use strict';
/* eslint func-names: 0 */

const gulp = require('gulp');
const $ = require('gulp-load-plugins')();

const allJS = 'src/**/*.js';
const unitTests = 'src/**/*.spec.js';
const e2eTests = 'src/**/*.e2e.js';
const allTests = [e2eTests, unitTests];

gulp.task('pre-coverage', function () {
   return gulp.src([allJS])
      // Covering files
      .pipe($.istanbul({ includeUntested: true }))
      // Force `require` to return covered files
      .pipe($.istanbul.hookRequire());
});

gulp.task('coverage', ['pre-coverage'], function () {
   return gulp.src([unitTests])
      .pipe($.mocha({ reporter: 'spec' }))
      // Creating the reports after tests ran
      .pipe($.istanbul.writeReports())
      // Enforce a coverage of at least 90%
      .pipe($.istanbul.enforceThresholds({ thresholds: { global: 90 } }));
});

gulp.task('test', function () {
   gulp.src(allTests)
      .pipe($.mocha({ reporter: 'spec' }));
});

gulp.task('watch', ['test'], function () {
   gulp.watch(allJS, function () {
      gulp.src(allTests)
         .pipe($.plumber())
         .pipe($.mocha({ reporter: 'spec' }));
   });
});
