import React, { lazy, Suspense } from 'react';
import { boundary, useError } from 'react-boundary';

import { InvalidUsage } from './InvalidUsage';
import { Loading } from './Loading';

const ChangeType = lazy(() => import('./addin/KontentSync').then((module) => ({ default: module.KontentSync })));
const Error = lazy(() => import('./Error').then((module) => ({ default: module.Error })));

export const App = boundary(() => {
  const [error, info] = useError();

  if (error || info) {
    return <Error stack={`${error && error.stack}${info && info.componentStack}`} />;
  }

  const invalidUsage = window.self === window.top;

  return (
    <Suspense fallback={<Loading />}>
      {invalidUsage && <InvalidUsage />}
      {!invalidUsage && <ChangeType />}
    </Suspense>
  );
});
