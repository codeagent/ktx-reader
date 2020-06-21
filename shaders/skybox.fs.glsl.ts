export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _pos;

uniform samplerCube env;

#define EXPOSURE  0.5f

vec3 gamma(const vec3 color) {
  return pow(color, vec3(1.0f/2.2f));
}

vec3 tone(const vec3 color) {
  return vec3(1.0f) - exp(-color * EXPOSURE);
}


void main()
{
  vec3 background = textureLod(env, normalize(_pos), 0.0f).rgb;

  color = vec4(gamma(tone(background)), 1.0f);
}
`;
