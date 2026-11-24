<!-- A turning circle for a button whose action is under way -->
<!-- Icon from Lucide (ISC license): loader-circle -->
<template>
  <svg class="spinner" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
</template>

<style scoped>
.spinner {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}

/* Slower, but still turning: it is the only sign on the button that the action is under way */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2.4s;
  }
}
</style>
