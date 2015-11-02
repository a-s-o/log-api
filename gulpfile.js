'use strict';
/* eslint func-names: 0 */

const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const istanbul = require('gulp-istanbul');

const allJS = 'src/**/*.js';
const unitTests = 'src/**/*.spec.js';
const e2eTests = 'src/**/*.e2e.js';
const allTests = [e2eTests, unitTests];

gulp.task('pre-coverage', function () {
   const isparta = require('isparta');
   return gulp.src([allJS, '!**/tests/**/*.js'])
      // Covering files
      .pipe(istanbul({
         includeUntested: true,
         instrumeter: isparta.Instrumenter
      }))
      // Force `require` to return covered files
      .pipe(istanbul.hookRequire());
});

// Create a coverage report
gulp.task('coverage', ['pre-coverage'], function () {
   return gulp.src([unitTests, e2eTests])
      .pipe($.mocha({ reporter: 'spec' }))
      // Creating the reports after tests ran
      .pipe(istanbul.writeReports());
      // Enforce a coverage of at least 90%
      // .pipe(istanbul.enforceThresholds({ thresholds: { global: 90 } }))
});

// Run the all tests [unit + e2e]
gulp.task('test', function () {
   return gulp.src(allTests)
      .pipe($.mocha({ reporter: 'spec' }))
      .on('error', err => { throw err; })
      .on('end', () => process.exit(0));
});

// Run e2e tests
gulp.task('e2e', function () {
   return gulp.src(e2eTests)
      .pipe($.mocha({ reporter: 'spec' }))
      .on('error', err => { throw err; })
      .on('end', () => process.exit(0));
});


// Run the unit tests in watch mode
gulp.task('unit', function () {
   function watch () {
      gulp.watch(allJS, function () {
         gulp.src([unitTests])
            .pipe($.plumber())
            .pipe($.mocha({ reporter: 'spec' }));
      });
   }

   return gulp.src([unitTests])
      .pipe($.mocha({ reporter: 'spec' }))
      .on('end', watch);
});
